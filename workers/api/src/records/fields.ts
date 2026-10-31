import {
  canonicalJson,
  EVERY_DAY,
  JobRecordFields,
  type JobRecordSubmit,
  JobTermsFields,
  JobWork,
  type UserId,
} from "@gigsync/protocol";
import { Side, sideOf } from "./sides.js";

/** A job from its own point of view (JobRecordFields): what two submissions must agree on. */
export type JobFields = JobRecordFields;

export function jobFields(sender: UserId, s: JobRecordSubmit): JobFields {
  const senderIsWorker = sideOf(s.role) === Side.worker;
  return {
    engagement: s.engagement,
    worker: senderIsWorker ? sender : s.counterpart,
    household: senderIsWorker ? s.counterpart : sender,
    work: s.work,
    ...(s.area ? { area: s.area } : {}),
    ...(s.quantities ? { quantities: s.quantities } : {}),
    terms: s.terms,
    price_paise: s.price_paise,
    terms_hash: s.terms_hash,
  };
}

/** The text two submissions are compared by: canonical JSON, so key order and absent keys never cause a mismatch. */
export const fieldsText = (f: JobFields): string => canonicalJson(f);

/** A stored submission's fields back; parsed, so text no schema accepts fails loudly. */
export const fieldsFrom = (text: string): JobFields => JobRecordFields.parse(JSON.parse(text));

/** job_records' scope and term columns. Dates as "YYYY-MM-DD" text: pg would parse a DATE in the local zone. */
export interface JobColumns {
  trade: JobWork["trade"];
  scope_problem: string | null;
  scope_rooms: string | null;
  scope_frequency: string | null;
  scope_people: string | null;
  scope_meals: string | null;
  scope_hours_band: string | null;
  scope_labour_only: boolean | null;
  work_day: string | null;
  work_daily: boolean;
  work_window: string | null;
  materials_by: string | null;
  coats: number | null;
  hours_per_day: number | null;
}

/** The yes/no a painter's scope carries. */
const YES = "yes";
const NO = "no";

export function columnsOf(work: JobWork, terms: JobTermsFields): JobColumns {
  const scope: Partial<Record<string, string>> = work.scope;
  const daily = terms.when?.day === EVERY_DAY;
  return {
    trade: work.trade,
    scope_problem: scope.problem ?? null,
    scope_rooms: scope.rooms ?? null,
    scope_frequency: scope.frequency ?? null,
    scope_people: scope.people ?? null,
    scope_meals: scope.meals ?? null,
    scope_hours_band: scope.hours ?? null,
    scope_labour_only: scope.labour_only === undefined ? null : scope.labour_only === YES,
    work_day: terms.when && !daily ? terms.when.day : null,
    work_daily: daily,
    work_window: terms.when?.window ?? null,
    materials_by: terms.materials ?? null,
    coats: terms.coats ?? null,
    hours_per_day: terms.hours ?? null,
  };
}

/** Drops the keys whose value is null, so a parsed object has only what was stored. */
const present = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null));

/** The work back from its columns; parsed, so a row that no schema accepts fails loudly instead of leaking out. */
export function workOf(c: JobColumns): JobWork {
  const labourOnly = c.scope_labour_only === null ? null : c.scope_labour_only ? YES : NO;
  const scope = present({
    problem: c.scope_problem,
    rooms: c.scope_rooms,
    frequency: c.scope_frequency,
    people: c.scope_people,
    meals: c.scope_meals,
    hours: c.scope_hours_band,
    labour_only: labourOnly,
  });
  return JobWork.parse({ trade: c.trade, scope });
}

export function termsOf(c: JobColumns): JobTermsFields {
  const day = c.work_daily ? EVERY_DAY : c.work_day;
  const when = day !== null && c.work_window !== null ? { day, window: c.work_window } : null;
  return JobTermsFields.parse(present({ when, materials: c.materials_by, coats: c.coats, hours: c.hours_per_day }));
}
