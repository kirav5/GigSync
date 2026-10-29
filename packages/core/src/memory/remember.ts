import { type Lang, type QuestionKey, Role, SKIPPED, type Trade } from "@gigsync/protocol";
import type { JobRecord, Need } from "../job/store.js";
import { log } from "../log.js";
import { load, save } from "./store.js";
import { type Asked, type Dated, type MemoryDoc, type MemoryWriter, type Person, STABLE_FACTS } from "./types.js";

/** `YYYY-MM-DD` out of an ISO timestamp: memory keeps the day, not the minute. */
const DAY_LENGTH = 10;
/** A remembered fact is a short answer; anything longer was not a stable fact. */
const VALUE_MAX = 120;
/** Questions kept per trade, newest first. */
const ASKED_MAX = 20;
/** People kept; the longest unseen drop off first. */
const PEOPLE_MAX = 200;
/** Jobs already counted, newest kept. */
const COUNTED_MAX = 500;
/**
 * A value that may be a phone, account, Aadhaar or payment reference (a long run of digits in any script), an email
 * or UPI ID, or a link: never remembered, whatever key it came under.
 */
const UNSAFE_VALUE = /[0-9०-९೦-೯][0-9०-९೦-೯\s-]{5,}|@|https?:|www\./i;

const R = Role.enum;

/** A question as a job record keeps it: a standard key, or a written question with its own key and text. */
type AskedLike = string | { key: string; text?: string; lang?: Lang };

/** A value worth keeping: given (not skipped), short, and nothing that could reach a person or their money. */
const safe = (value: string | undefined): value is string =>
  value !== undefined &&
  value.trim().length > 0 &&
  value !== SKIPPED &&
  value.length <= VALUE_MAX &&
  !UNSAFE_VALUE.test(value);

/** The stable, safe facts among some details, dated today. */
function stableFacts(details: Record<string, string>, on: string): Partial<Record<QuestionKey, Dated>> {
  const kept: Partial<Record<QuestionKey, Dated>> = {};
  for (const key of STABLE_FACTS) {
    const value = details[key];
    if (safe(value)) kept[key] = { value: value.trim(), on };
  }
  return kept;
}

/** Both sides signed the same terms: the only jobs memory learns about the other side from. */
const signedByBoth = (job: JobRecord) =>
  job.mine !== undefined && job.theirs !== undefined && job.mine.terms_hash === job.theirs.terms_hash;

function updatedPerson(doc: MemoryDoc, job: JobRecord, on: string, firstTime: boolean): Person | undefined {
  const user = job.engagement.counterpart;
  const before = doc.people[user];
  // Counted already but gone: the owner forgot them, so a late contact card must not bring them back.
  if (!before && !firstTime) return undefined;
  const trade = job.request.trade;
  const theirRole = job.engagement.role === R.requester ? R.provider : R.requester;
  const theirDetails = theirRole === R.requester ? stableFacts({ ...job.request.details, ...job.answers }, on) : {};
  const name = job.contact?.name ?? before?.name;
  const price = job.mine?.terms.price_paise;
  return {
    user,
    role: theirRole,
    ...(name ? { name } : {}),
    trades: before?.trades.includes(trade) ? before.trades : [...(before?.trades ?? []), trade],
    jobs: (before?.jobs ?? 0) + (firstTime ? 1 : 0),
    details: { ...before?.details, ...theirDetails },
    ...(theirRole === R.requester ? { lang: job.request.lang } : {}),
    ...(price !== undefined ? { last_price_paise: price } : {}),
    last_on: on,
  };
}

const askedKey = (q: AskedLike) => (typeof q === "string" ? q : q.key);

/** The questions this job asked, merged in front of those asked before for the trade, without repeats. */
function updatedAsked(before: Asked[], job: JobRecord, on: string): Asked[] {
  const answers = job.answers ?? {};
  const now: Asked[] = (job.questions ?? []).map((q: AskedLike) => {
    const key = askedKey(q);
    const { text, lang }: { text?: string; lang?: Lang } = typeof q === "string" ? {} : q;
    return {
      key,
      ...(text ? { text } : {}),
      ...(lang ? { lang } : {}),
      answered: key in answers && answers[key] !== SKIPPED,
      on,
    };
  });
  const id = (a: Asked) => a.text ?? a.key;
  const seen = new Set(now.map(id));
  return [...now, ...before.filter((a) => !seen.has(id(a)))].slice(0, ASKED_MAX);
}

function keepNewestPeople(people: Record<string, Person>): Record<string, Person> {
  const all = Object.values(people).sort((a, b) => b.last_on.localeCompare(a.last_on));
  return Object.fromEntries(all.slice(0, PEOPLE_MAX).map((p) => [p.user, p]));
}

/** The household's own facts and area from this job: theirs to keep even when the job was not signed. */
function withOwnFacts(doc: MemoryDoc, job: JobRecord, need: Need | undefined, on: string): MemoryDoc {
  if (job.engagement.role !== R.requester) return doc;
  const facts = stableFacts({ ...job.request.details, ...job.answers, ...need?.details }, on);
  return { ...doc, facts: { ...doc.facts, ...facts }, area: { place: need?.area ?? job.request.area, on } };
}

function withSignedJob(doc: MemoryDoc, job: JobRecord, on: string): MemoryDoc {
  const firstTime = !doc.counted.includes(job.engagement.id);
  const person = updatedPerson(doc, job, on, firstTime);
  const trade: Trade = job.request.trade;
  const asked =
    job.engagement.role === R.provider && firstTime
      ? { ...doc.asked, [trade]: updatedAsked(doc.asked[trade] ?? [], job, on) }
      : doc.asked;
  const people = person ? keepNewestPeople({ ...doc.people, [person.user]: person }) : doc.people;
  const counted = firstTime ? [...doc.counted, job.engagement.id].slice(-COUNTED_MAX) : doc.counted;
  return { ...doc, people, asked, counted };
}

/**
 * Learns from a job once both sides signed it, on either side: the household's own facts and the worker it hired, or
 * the household a worker served and what was asked for the trade. Safe to call again for the same job (the contact
 * card arriving later adds the name); never throws, since a job must never fail because memory could not be written.
 */
export async function remember(writer: MemoryWriter, job: JobRecord, need?: Need): Promise<void> {
  try {
    const on = writer.clock.now().toISOString().slice(0, DAY_LENGTH);
    const doc = withOwnFacts(await load(writer.storage, writer.me.user), job, need, on);
    await save(writer.storage, signedByBoth(job) ? withSignedJob(doc, job, on) : doc);
  } catch (err) {
    log.warn("memory not saved", {
      engagement: job.engagement.id,
      error: err instanceof Error ? err.name : typeof err,
    });
  }
}
