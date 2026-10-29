import { type CancelReason, Question, Role } from "@gigsync/protocol";
import { QUESTIONS } from "./ask.js";
import type { AnswerSource, JobRecord } from "./store.js";

/** One thing that happened between the two agents, and the owners' signatures that closed it. */
export const TalkKind = {
  request: "request",
  questions: "questions",
  answers: "answers",
  offer: "offer",
  agreed: "agreed",
  signed: "signed",
  contacts: "contacts",
  ended: "ended",
} as const;

/** One answer in the story: the question it answers, the words, and (household side) where the agent found them. */
export interface TalkAnswer {
  question: Question;
  text: string;
  source?: AnswerSource;
}

export type TalkStep =
  | { kind: typeof TalkKind.request; by: Role }
  | { kind: typeof TalkKind.questions; by: Role; questions: Question[] }
  | { kind: typeof TalkKind.answers; by: Role; answers: TalkAnswer[] }
  | { kind: typeof TalkKind.offer; by: Role; price_paise: number }
  | { kind: typeof TalkKind.agreed; price_paise: number }
  | { kind: typeof TalkKind.signed; by: Role }
  | { kind: typeof TalkKind.contacts }
  | { kind: typeof TalkKind.ended; reason: CancelReason };

const R = Role.enum;
const other = (role: Role): Role => (role === R.provider ? R.requester : R.provider);

/**
 * The questions asked, as sent: kept on the job since round 2 (bare keys until round 3, written questions since);
 * older worker-side jobs fall back to the trade's list. Anything that no longer reads as a question is left out.
 */
function questionsOf(job: JobRecord): Question[] {
  const kept =
    job.questions ??
    (job.asked ? QUESTIONS[job.request.trade].filter((k) => job.request.details[k] !== undefined) : []);
  return kept.flatMap((q) => {
    const parsed = Question.safeParse(typeof q === "string" ? { key: q } : q);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Each asked question with the answer the household gave, as written; questions with no answer yet are left out. */
function answersOf(job: JobRecord, questions: readonly Question[]): TalkAnswer[] {
  const given = job.answers ?? (job.engagement.role === R.provider ? job.request.details : {});
  return questions.flatMap((question) => {
    const text = given[question.key];
    const source = job.answered_from?.[question.key];
    return text === undefined ? [] : [{ question, text, ...(source ? { source } : {}) }];
  });
}

/**
 * The story of a job as the two agents told it, from this phone's record, in order: the request, the worker's agent's
 * questions and the household's answers, every offer, the agreement, each owner's signature, the contacts, or how it
 * ended. Private limits are never in it: they were never sent.
 */
export function agentTalk(job: JobRecord): TalkStep[] {
  const steps: TalkStep[] = [{ kind: TalkKind.request, by: R.requester }];
  const questions = questionsOf(job);
  if (questions.length > 0) {
    steps.push({ kind: TalkKind.questions, by: R.provider, questions });
    const answers = answersOf(job, questions);
    if (answers.length > 0) steps.push({ kind: TalkKind.answers, by: R.requester, answers });
  }
  for (const { by, offer } of job.offers) steps.push({ kind: TalkKind.offer, by, price_paise: offer.price_paise });
  const signed = job.mine ?? job.theirs;
  if (signed) steps.push({ kind: TalkKind.agreed, price_paise: signed.terms.price_paise });
  if (job.mine) steps.push({ kind: TalkKind.signed, by: job.engagement.role });
  if (job.theirs) steps.push({ kind: TalkKind.signed, by: other(job.engagement.role) });
  if (job.contact) steps.push({ kind: TalkKind.contacts });
  if (job.cancel) steps.push({ kind: TalkKind.ended, reason: job.cancel.reason });
  return steps;
}
