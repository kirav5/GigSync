import {
  AGENT_OFFERS,
  balanceDue,
  bookingDayText,
  dayOf,
  FINISHED_WORK,
  hourText,
  type JobRecord,
  jobProgress,
  nextWorkerStep,
  type OwnerTask,
  TaskKind,
  type TimeAsk,
  whenText,
} from "@gigsync/core";
import {
  EngagementStatus,
  type JobTerms,
  type Payment,
  PaymentMethod,
  PaymentStatus,
  type Question,
  ROUNDS_BEFORE_OWNERS,
  Role,
  type TermWhen,
  UpdateCode,
} from "@gigsync/protocol";
import type { I18n } from "../../i18n.js";
import { jobPrice, money } from "../../ui/places.js";
import { requestWork } from "../../ui/work.js";
import { daysFrom } from "../jobGroups.js";

/**
 * How a row's status pill looks: rust while the move is the owner's, plain while the agents talk, the picked tint
 * once agreed, and green only once the money is in.
 */
export const WordTone = { act: "act", talk: "talk", done: "done", paid: "paid" } as const;
export type WordTone = (typeof WordTone)[keyof typeof WordTone];

/** A job as its row shows it: the work, a pill with the move or the state, a short fact beside it, the amount. */
export interface RowWords {
  /** The work, and where it is for the worker: "Carpenter · Whitefield". */
  line: string;
  /** The pill: the owner's move ("Sign"), or where the job stands ("Agents negotiating", "Paid"). */
  word: string;
  tone: WordTone;
  /** Beside the pill: when the work is, what a decision is about, or the agents' turn. */
  meta?: string | undefined;
  /** At the end: the price to sign, the price signed, or the latest offer while the agents talk. */
  amount?: string | undefined;
}

/** What a row reads from the phone besides the job: the open tasks, the payments, the day, and if it is today's. */
export interface RowFacts {
  tasks: readonly OwnerTask[];
  payments: readonly Payment[];
  /** This phone's day ("YYYY-MM-DD"), for "Today", "Tomorrow" and "Yesterday". */
  day: string;
  /** Signed work for today: a worker who has not set off is asked "On the way?". */
  today: boolean;
}

type Say = Pick<I18n, "lang" | "t" | "plural">;

const P = PaymentStatus.enum;
const S = EngagementStatus.enum;
/** Between the pieces of a row's line. */
const DOT = " · ";
/** The day before this phone's, which "Yesterday" names. */
const YESTERDAY = -1;
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

/** A day as the owner says it from today: "Today", "Tomorrow", "Yesterday", "Every day", else "Sat, 15 Nov". */
function dayWord({ lang, t }: Say, day: string, today: string): string {
  return daysFrom(today, day) === YESTERDAY ? t("jobs.day.yesterday") : bookingDayText(lang, day, today);
}

/** When the work is: the agreed day and time ("Today, 2 pm"), else the day the request asked for. */
function whenOf(say: Say, job: JobRecord, today: string): string | undefined {
  const agreed: TermWhen | undefined = job.mine?.terms.terms?.when ?? job.time ?? job.request.terms?.when;
  if (agreed) {
    const time = agreed.hour !== undefined ? hourText(say.lang, agreed.hour) : say.t(`terms.window.${agreed.window}`);
    return say.t("terms.when", { day: dayWord(say, agreed.day, today), window: time });
  }
  const day = dayOf(job.request);
  return day === undefined ? undefined : dayWord(say, day, today);
}

/** The work, and the locality for a worker, who goes there. */
function workLine({ t }: Say, job: JobRecord): string {
  const isWorker = job.engagement.role === Role.enum.provider;
  return lineOf(requestWork(t, job.request), isWorker ? job.request.locality : undefined);
}

/** A decision waiting on the owner: the one word that answers it, and what it is about. */
function decideWords(say: Say, job: JobRecord, task: OwnerTask, day: string): RowWords {
  const { lang, t, plural } = say;
  const act = (word: string, meta: string | undefined, amount?: string): RowWords => ({
    line: workLine(say, job),
    word,
    tone: WordTone.act,
    meta,
    amount,
  });
  switch (task.kind) {
    case TaskKind.confirmDeal: {
      const terms = task.detail as JobTerms;
      return act(t("jobs.word.sign"), whenOf(say, job, day), jobPrice(lang, job.request, terms.price_paise));
    }
    case TaskKind.confirmPayment:
      return act(t("jobs.word.check"), whenOf(say, job, day));
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
 * The agents still talking: where the talk is as the pill, whose turn it is out of the offers an agent makes (ADR 0053
 * §4) beside it, and the latest offer at the end. Past the agents' own offers the owners' cap counts instead.
 */
function talkWords(say: Say, job: JobRecord): RowWords {
  const made = job.offers_made;
  const max = made > AGENT_OFFERS ? (job.rounds ?? ROUNDS_BEFORE_OWNERS) : AGENT_OFFERS;
  const last = job.offers.at(-1)?.offer.price_paise;
  return {
    line: workLine(say, job),
    word: say.t(`status.${job.engagement.status}`),
    tone: WordTone.talk,
    meta: made > 0 ? say.t("jobs.line.turn", { n: Math.min(made, max), max }) : undefined,
    amount: last === undefined ? undefined : jobPrice(say.lang, job.request, last),
  };
}

/** A move the owner can make on signed work without a task: pay, review, set off, or ask to be paid. */
function nextMove({ t }: Say, job: JobRecord, facts: RowFacts): string | undefined {
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

/** The price both signed, as the job's card says it. */
function signedPrice(say: Say, job: JobRecord): string | undefined {
  const terms = job.mine?.terms;
  return terms ? jobPrice(say.lang, job.request, terms.price_paise) : undefined;
}

/** Where signed work stands: the last step reached, green once the money is in. */
function stepWords(say: Say, job: JobRecord, payments: readonly Payment[]): Pick<RowWords, "word" | "tone"> {
  const mine = payments.filter((p) => p.engagement === job.engagement.id);
  const reached = jobProgress(job, mine)
    ?.filter((s) => s.reached)
    .at(-1);
  const paid = mine.some((p) => p.status === P.confirmed && !p.advance);
  const word = reached ? say.t(`progress.${reached.step}`) : say.t(`status.${job.engagement.status}`);
  return { word, tone: paid ? WordTone.paid : WordTone.done };
}

/** Signed work: the owner's next move or the last step reached, when it is, and the price. */
function agreedWords(say: Say, job: JobRecord, facts: RowFacts): RowWords {
  const base = { line: workLine(say, job), meta: whenOf(say, job, facts.day), amount: signedPrice(say, job) };
  const move = nextMove(say, job, facts);
  if (move) return { ...base, word: move, tone: WordTone.act };
  return { ...base, ...stepWords(say, job, facts.payments) };
}

/** A finished job's row: the work, where it ended, and the price; its day is the heading above it. */
export const doneWords = (say: Say, job: JobRecord, payments: readonly Payment[]): RowWords => ({
  line: workLine(say, job),
  amount: signedPrice(say, job),
  ...stepWords(say, job, payments),
});

/** How a job's row reads: an open decision first, then signed work, else the agents' talk. */
export function rowWords(say: Say, job: JobRecord, facts: RowFacts): RowWords {
  const id = job.engagement.id;
  const open = facts.tasks.filter((k) => k.engagement === id);
  const task = TASK_ORDER.map((kind) => open.find((k) => k.kind === kind)).find((k) => k !== undefined);
  if (task) return decideWords(say, job, task, facts.day);
  const payments = facts.payments.filter((p) => p.engagement === id);
  if (jobProgress(job, payments)) return agreedWords(say, job, facts);
  return talkWords(say, job);
}
