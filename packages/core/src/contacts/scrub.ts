import type { ContactCard } from "@gigsync/protocol";
import type { JobRecord, Need } from "../job/store.js";
import { REMOVED_MARK, withoutPhones } from "./phones.js";

/**
 * Taking the contact details out of a settled job (ADR 0039 §3): the other side's whole card, and from the job's own
 * words (the need, its details, the answers, the notes, a review, a cancellation or problem note) every phone number
 * and every copy of an address either card holds. Addresses are never guessed at: only a card's own address, as
 * written, is found in the words. The signed terms, offers, payments, stars and the agents' structured talk stay.
 */

/** An address shorter than this is too likely to be an ordinary word to look for in someone's text. */
const MIN_ADDRESS_LENGTH = 6;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;
const ANY_CASE = "gi";

/** One way of cleaning a piece of text. */
type Clean = (text: string) => string;

/** A cleaner for these cards' addresses and every phone number. */
export function cleanerFor(cards: readonly (ContactCard | undefined)[]): Clean {
  const addresses = cards
    .map((c) => c?.address?.trim())
    .filter((a): a is string => a !== undefined && a.length >= MIN_ADDRESS_LENGTH)
    .map((a) => new RegExp(a.replace(REGEX_SPECIAL, "\\$&"), ANY_CASE));
  return (text) => addresses.reduce((out, re) => out.replace(re, REMOVED_MARK), withoutPhones(text));
}

/** Each value of a record cleaned. */
const cleanValues = (values: Record<string, string>, clean: Clean): Record<string, string> =>
  Object.fromEntries(Object.entries(values).map(([k, v]) => [k, clean(v)]));

/** Sets `key` only when the record had it, so a clean job keeps exactly the same shape. */
function cleaned<T, K extends keyof T>(from: T, key: K, map: (value: NonNullable<T[K]>) => T[K]): Partial<T> {
  const value = from[key];
  return value === undefined || value === null ? {} : ({ [key]: map(value) } as unknown as Partial<T>);
}

/** The job without the other side's card and with its words cleaned; the same job again when there was nothing. */
export function scrubJob(job: JobRecord, clean: Clean): JobRecord {
  const { contact: _card, ...rest } = job;
  const { engagement: e, request } = job;
  return {
    ...rest,
    engagement: { ...e, brief: { ...e.brief, text: clean(e.brief.text), shared: cleanValues(e.brief.shared, clean) } },
    request: {
      ...request,
      need: clean(request.need),
      when: clean(request.when),
      details: cleanValues(request.details, clean),
    },
    ...cleaned(job, "answers", (a) => cleanValues(a, clean)),
    ...cleaned(job, "suggested", (s) =>
      Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { ...v, text: clean(v.text) }])),
    ),
    ...cleaned(job, "notes", (notes) => notes.map((n) => ({ ...n, text: clean(n.text) }))),
    ...cleaned(job, "review", (r) => ({ ...r, text: clean(r.text) })),
    ...cleaned(job, "cancel", (c) => (c.note === undefined ? c : { ...c, note: clean(c.note) })),
    ...cleaned(job, "problem", (p) => (p.text === undefined ? p : { ...p, text: clean(p.text) })),
  };
}

/** A household's need, cleaned the same way: it is the words its signed request was made from. */
export function scrubNeed(need: Need, clean: Clean): Need {
  return { ...need, need: clean(need.need), when: clean(need.when), details: cleanValues(need.details, clean) };
}
