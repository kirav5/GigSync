import {
  type Introduction,
  type JobRecord,
  type MessageKey,
  type OwnerTask,
  type Params,
  type ReceivedOffer,
  type ReceivedRequest,
  RequestState,
  TaskKind,
} from "@gigsync/core";
import { type City, type EngagementId, EngagementStatus, Role } from "@gigsync/protocol";
import { money } from "../../ui/places.js";

/**
 * Alerts (design P6) as plain data, newest first: each decision waiting (the same tasks and offers as Jobs' Awaiting
 * you), what each job reached and when (its status stamps), a household's recommendation, and mentor notes waiting for
 * an answer. Built from what the phone already holds; nothing is fetched and nothing is kept.
 */

/** What a row's end says: a payment to confirm, another decision, or nothing (news). */
export const AlertNext = { confirm: "confirm", decide: "decide", none: "none" } as const;
export type AlertNext = (typeof AlertNext)[keyof typeof AlertNext];

export interface AlertItem {
  id: string;
  at: string;
  /** The job it is about, for the other side's name and the work; none for an offer or a mentor note. */
  job: JobRecord | undefined;
  /** The person's own name when the alert carries it: an offer's card, a mentor note's. */
  name: string | undefined;
  what: MessageKey;
  params: Params;
  next: AlertNext;
}

/** The alerts on one day, the day as `YYYY-MM-DD` on this phone. */
export interface AlertDay {
  day: string;
  items: AlertItem[];
}

/** What the feed is built from: the phone's jobs, tasks and offers, its mentor notes, and a city's name. */
export interface FeedInput {
  jobs: readonly JobRecord[];
  tasks: readonly OwnerTask[];
  offers: readonly ReceivedOffer[];
  intros: readonly Introduction[];
  incoming: readonly ReceivedRequest[];
  cityName: (city: City) => string;
}

/** The most rows kept, newest first: older news stays in each job's own story. */
export const MAX_ALERTS = 60;

const S = EngagementStatus.enum;

/** The statuses worth a line, said as the job's progress says them: the deal signed, the day's moves, the end. */
const STAMP_WORDS: Partial<Record<EngagementStatus, MessageKey>> = {
  [S.agreed]: "me.alert.signed",
  [S.in_progress]: "status.in_progress",
  [S.delivered]: "status.delivered",
  [S.closed]: "status.closed",
  [S.cancelled]: "status.cancelled",
};

/** Each decision's line; a deal to sign says its price when the pending terms are on the job. */
const TASK_WORDS: Readonly<Record<TaskKind, MessageKey>> = {
  [TaskKind.confirmDeal]: "me.alert.deal",
  [TaskKind.answerQuestions]: "me.alert.answer_questions",
  [TaskKind.confirmPayment]: "me.alert.confirm_payment",
  [TaskKind.approveRequest]: "me.alert.approve_request",
  [TaskKind.takeOver]: "me.alert.take_over",
  [TaskKind.newTime]: "me.alert.new_time",
};

/** Between a job's id and what the row says of it, so each row keeps one key. */
const SEP = "|";
const RECOMMENDED = "recommended";

const item = (part: Omit<AlertItem, "job" | "name" | "params"> & Partial<AlertItem>): AlertItem => ({
  job: undefined,
  name: undefined,
  params: {},
  ...part,
});

function taskItem(task: OwnerTask, byId: ReadonlyMap<EngagementId, JobRecord>): AlertItem {
  const job = byId.get(task.engagement);
  const price = task.kind === TaskKind.confirmDeal ? job?.pending?.price_paise : undefined;
  return item({
    id: task.id,
    at: task.created_at,
    job,
    what: price === undefined ? TASK_WORDS[task.kind] : "me.alert.confirm_deal",
    params: price === undefined ? {} : { price: money(price) },
    next: task.kind === TaskKind.confirmPayment ? AlertNext.confirm : AlertNext.decide,
  });
}

/** What one job reached, each step once, and (worker) that the household recommended them (ADR 0055). */
function jobItems(job: JobRecord): AlertItem[] {
  const id = job.engagement.id;
  const stamps = (job.history ?? []).flatMap((s) => {
    const what = STAMP_WORDS[s.status];
    return what ? [item({ id: id + SEP + s.status, at: s.at, job, what, next: AlertNext.none })] : [];
  });
  const told = job.engagement.role === Role.enum.provider ? job.recommended_at : undefined;
  if (!told) return stamps;
  return [
    ...stamps,
    item({ id: id + SEP + RECOMMENDED, at: told, job, what: "me.alert.recommended", next: AlertNext.none }),
  ];
}

/** Mentor notes waiting for this owner: an introduction not answered yet, a newcomer's request not answered yet. */
function mentorItems(i: FeedInput): AlertItem[] {
  const intros = i.intros
    .filter((x) => !x.mine)
    .map((x) =>
      item({
        id: x.channel,
        at: x.at,
        name: x.card.name,
        what: "me.alert.intro",
        params: { city: i.cityName(x.city) },
        next: AlertNext.decide,
      }),
    );
  const asks = i.incoming
    .filter((r) => r.state === RequestState.sent)
    .map((r) =>
      item({
        id: r.channel,
        at: r.at,
        name: r.request.card.name,
        what: "me.alert.request",
        params: { city: i.cityName(r.request.city) },
        next: AlertNext.decide,
      }),
    );
  return [...intros, ...asks];
}

/** Every alert, newest first, at most `MAX_ALERTS`. */
export function alertFeed(i: FeedInput): AlertItem[] {
  const byId = new Map(i.jobs.map((j) => [j.engagement.id, j]));
  const offers = i.offers.map((o) =>
    item({ id: o.channel, at: o.at, name: o.card.display_name, what: "me.alert.offer", next: AlertNext.decide }),
  );
  return [...i.tasks.map((t) => taskItem(t, byId)), ...offers, ...i.jobs.flatMap(jobItems), ...mentorItems(i)]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_ALERTS);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A moment's day on this phone's clock, as `YYYY-MM-DD`. */
export const dayOf = (at: Date): string => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/** The feed in days, newest first, each day's alerts in the feed's order. */
export function byDay(items: readonly AlertItem[]): AlertDay[] {
  const days: AlertDay[] = [];
  for (const one of items) {
    const day = dayOf(new Date(one.at));
    const last = days.at(-1);
    if (last?.day === day) last.items.push(one);
    else days.push({ day, items: [one] });
  }
  return days;
}
