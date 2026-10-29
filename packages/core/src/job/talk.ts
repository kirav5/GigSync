import { type CancelReason, QuestionKey, Role } from "@gigsync/protocol";
import type { JobRecord } from "./store.js";
import { QUESTIONS } from "./worker.js";

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

export type TalkStep =
  | { kind: typeof TalkKind.request; by: Role }
  | { kind: typeof TalkKind.questions; by: Role; keys: QuestionKey[] }
  | { kind: typeof TalkKind.answers; by: Role; answers: [key: QuestionKey, text: string][] }
  | { kind: typeof TalkKind.offer; by: Role; price_paise: number }
  | { kind: typeof TalkKind.agreed; price_paise: number }
  | { kind: typeof TalkKind.signed; by: Role }
  | { kind: typeof TalkKind.contacts }
  | { kind: typeof TalkKind.ended; reason: CancelReason };

const R = Role.enum;
const other = (role: Role): Role => (role === R.provider ? R.requester : R.provider);

/** The questions asked, by key: kept on the job since round 2; older worker-side jobs fall back to the trade's list. */
function questionsOf(job: JobRecord): QuestionKey[] {
  if (job.questions) return job.questions;
  if (!job.asked) return [];
  return QUESTIONS[job.request.trade].filter((k) => job.request.details[k] !== undefined);
}

/** Each asked question with the answer the household gave, as written; questions with no answer yet are left out. */
function answersOf(job: JobRecord, keys: readonly QuestionKey[]): [QuestionKey, string][] {
  const given = job.answers ?? (job.engagement.role === R.provider ? job.request.details : {});
  return keys.flatMap((k) => {
    const text = given[k];
    return text === undefined ? [] : [[k, text] as [QuestionKey, string]];
  });
}

/**
 * The story of a job as the two agents told it, from this phone's record, in order: the request, the worker's agent's
 * questions and the household's answers, every offer, the agreement, each owner's signature, the contacts, or how it
 * ended. Private limits are never in it: they were never sent.
 */
export function agentTalk(job: JobRecord): TalkStep[] {
  const steps: TalkStep[] = [{ kind: TalkKind.request, by: R.requester }];
  const keys = questionsOf(job).filter((k) => QuestionKey.safeParse(k).success);
  if (keys.length > 0) {
    steps.push({ kind: TalkKind.questions, by: R.provider, keys });
    const answers = answersOf(job, keys);
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
