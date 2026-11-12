import {
  AGENT_OFFERS,
  balanceDue,
  dayOf,
  EVERY_DAY,
  FINISHED_WORK,
  type JobRecord,
  jobProgress,
  LOCALE,
  nextWorkerStep,
  type OwnerTask,
  TaskKind,
  type TimeAsk,
  whenText,
} from "@gigsync/core";
import {
  EngagementStatus,
  type JobTerms,
  type Lang,
  type Payment,
  PaymentMethod,
  PaymentStatus,
  type Question,
  ROUNDS_BEFORE_OWNERS,
  Role,
  UpdateCode,
} from "@gigsync/protocol";
import type { I18n } from "../../i18n.js";
import { jobPrice, money } from "../../ui/places.js";
import { requestWork } from "../../ui/work.js";
import { dayDate } from "../jobGroups.js";

/** How a row's end word looks: rust while the move is the owner's, muted while the agents talk, green once agreed. */
export const WordTone = { act: "act", talk: "talk", done: "done" } as const;
export type WordTone = (typeof WordTone)[keyof typeof WordTone];

/** A job as its one-line row says it: the work and where it stands, and the word at the end. */
export interface RowWords {
  line: string;
  word: string;
  tone: WordTone;
}

/** What a row reads from the phone besides the job: the open tasks, the payments, and whether it is today's. */
export interface RowFacts {
  tasks: readonly OwnerTask[];
  payments: readonly Payment[];
  today: boolean;
}

type Say = Pick<I18n, "lang" | "t" | "plural" | "date">;

const P = PaymentStatus.enum;
const S = EngagementStatus.enum;
/** Between the pieces of a row's line. */
const DOT = " · ";
/** When a job has more than one decision open, the one its row names: signing first, as the card shows them. */
const TASK_ORDER: readonly TaskKind[] = [
  TaskKind.confirmDeal,
  TaskKind.confirmPayment,
  TaskKind.approveRequest,
  TaskKind.answerQuestions,
  TaskKind.newTime,
  TaskKind.takeOver,
];

const lineOf = (...pieces: (string | undefined)[]) => pieces.filter(Boolean).join(DOT);

/** The other side's name, in the order the job's card finds it, so a row and its card always agree. */
export function themOf(job: JobRecord, names: Readonly<Record<string, string>>, t: I18n["t"]): string {
  const isWorker = job.engagement.role === Role.enum.provider;
  return (
    names[job.engagement.counterpart] ||
    job.contact?.name ||
    job.their_name ||
    t(isWorker ? "job.customer" : "job.worker")
  );
}

/** Several people's names as one phrase in the owner's language: "Priya and Meena". */
export const namesText = (lang: Lang, names: readonly string[]): string =>
  new Intl.ListFormat(LOCALE[lang], { type: "conjunction" }).format(names);

/** When the work is, in this phone's words: the agreed time, else the day the request asked for. */
function whenOf({ lang, t, date }: Say, job: JobRecord): string | undefined {
  const agreed = job.mine?.terms.terms?.when ?? job.time ?? job.request.terms?.when;
  if (agreed) return whenText(lang, agreed);
  const day = dayOf(job.request);
  if (day === undefined) return undefined;
  return day === EVERY_DAY ? t("when.daily") : date(dayDate(day));
}

/** A decision waiting on the owner: what it is about, and the one word that answers it. */
function decideWords(say: Say, job: JobRecord, task: OwnerTask, payments: readonly Payment[]): RowWords {
  const { lang, t, plural } = say;
  const act = (word: string, detail: string): RowWords => ({
    line: lineOf(requestWork(t, job.request), detail),
    word,
    tone: WordTone.act,
  });
  switch (task.kind) {
    case TaskKind.confirmDeal: {
      const terms = task.detail as JobTerms;
      const price = jobPrice(lang, job.request, terms.price_paise);
      return act(t("jobs.word.sign"), t("jobs.line.reached", { price }));
    }
    case TaskKind.confirmPayment: {
      const paid = payments.find((p) => p.status === P.paid);
      return act(t("jobs.word.check"), paid ? t("jobs.line.paid", { price: money(paid.amount_paise) }) : "");
    }
    case TaskKind.approveRequest:
      return act(t("jobs.word.decide"), t("jobs.line.request"));
    case TaskKind.answerQuestions:
      return act(t("jobs.word.answer"), plural("jobs.line.questions", (task.detail as Question[]).length));
    case TaskKind.newTime: {
      const ask = task.detail as TimeAsk;
      const when = ask.when && !ask.passed ? ask.when : undefined;
      return act(
        t("jobs.word.answer"),
        when ? t("jobs.line.new_time", { when: whenText(lang, when) }) : t("jobs.line.time_passed"),
      );
    }
    case TaskKind.takeOver:
      // Even while the other owner has the turn, this one may take their offer: either way the decision is theirs.
      return act(t("jobs.word.decide"), t("jobs.line.take_over"));
  }
}

/**
 * The agents still talking: whose turn it is out of the offers an agent makes (ADR 0053 §4), or, before any offer,
 * what the talk is at. Past the agents' own offers the owners' cap counts instead.
 */
function talkWords({ t }: Say, job: JobRecord): RowWords {
  const made = job.offers_made;
  const max = made > AGENT_OFFERS ? (job.rounds ?? ROUNDS_BEFORE_OWNERS) : AGENT_OFFERS;
  const where = made > 0 ? t("jobs.line.turn", { n: Math.min(made, max), max }) : t(`status.${job.engagement.status}`);
  return { line: lineOf(requestWork(t, job.request), where), word: t("jobs.word.talks"), tone: WordTone.talk };
}

/** A move the owner can make on signed work without a task: pay, review, set off, or ask to be paid. */
function nextMove(say: Say, job: JobRecord, facts: RowFacts): string | undefined {
  const { t } = say;
  const mine = facts.payments.filter((p) => p.engagement === job.engagement.id);
  if (job.engagement.role === Role.enum.requester) {
    const asked = mine.find((p) => p.status === P.requested && p.method === PaymentMethod.enum.upi);
    if (asked) return t("jobs.word.pay", { price: money(asked.amount_paise) });
    const paidUp = mine.some((p) => p.status === P.confirmed && !p.advance);
    return job.engagement.status === S.delivered && !job.review && paidUp ? t("jobs.word.review") : undefined;
  }
  if (facts.today && nextWorkerStep(job) === UpdateCode.enum.on_my_way) return t("jobs.word.set_off");
  if (!FINISHED_WORK.has(job.engagement.status)) return undefined;
  const due = balanceDue(job, mine);
  return due > 0 ? t("jobs.word.ask", { price: money(due) }) : undefined;
}

/** Signed work: when it is (and where, for the worker), and the owner's next move or the last step reached. */
function agreedWords(say: Say, job: JobRecord, facts: RowFacts): RowWords {
  const { t } = say;
  const isWorker = job.engagement.role === Role.enum.provider;
  const line = lineOf(requestWork(t, job.request), whenOf(say, job), isWorker ? job.request.locality : undefined);
  const move = nextMove(say, job, facts);
  if (move) return { line, word: move, tone: WordTone.act };
  const reached = jobProgress(job, facts.payments)
    ?.filter((s) => s.reached)
    .at(-1);
  const word = reached ? t(`progress.${reached.step}`) : t(`status.${job.engagement.status}`);
  return { line, word, tone: WordTone.done };
}

/** How a job's row reads: an open decision first, then signed work, else the agents' talk. */
export function rowWords(say: Say, job: JobRecord, facts: RowFacts): RowWords {
  const id = job.engagement.id;
  const open = facts.tasks.filter((k) => k.engagement === id);
  const task = TASK_ORDER.map((kind) => open.find((k) => k.kind === kind)).find((k) => k !== undefined);
  const payments = facts.payments.filter((p) => p.engagement === id);
  if (task) return decideWords(say, job, task, payments);
  if (jobProgress(job, payments)) return agreedWords(say, job, facts);
  return talkWords(say, job);
}
