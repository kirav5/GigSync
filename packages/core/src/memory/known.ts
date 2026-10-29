import { type AnswerFromMemory, type Place, QuestionKey } from "@gigsync/protocol";
import { answerFromMemory } from "./setting.js";
import { load } from "./store.js";
import type { Dated, MemoryWriter } from "./types.js";

/**
 * A fact given more than this many days ago (from the day it was last given) is never used on its own: households
 * move, children grow, pets come and go. It may still be offered for the owner to confirm.
 */
export const MEMORY_FRESH_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A remembered value, and whether it is recent enough to use without asking. */
export interface Known {
  value: string;
  fresh: boolean;
}

/** What the household's agent may answer from: its owner's stable facts and area, and how the owner wants it used. */
export interface HouseholdKnown {
  mode: AnswerFromMemory;
  facts: Partial<Record<QuestionKey, Known>>;
  area?: { place: Place; fresh: boolean };
}

/** Whether a day (`YYYY-MM-DD`) is within `MEMORY_FRESH_DAYS` of now; an unreadable day is not. */
export function isFresh(on: string, now: Date): boolean {
  const given = Date.parse(on);
  return Number.isFinite(given) && now.getTime() - given <= MEMORY_FRESH_DAYS * DAY_MS;
}

const known = (d: Dated, now: Date): Known => ({ value: d.value, fresh: isFresh(d.on, now) });

/** The household owner's remembered facts and area, each marked fresh or not, with the owner's setting. */
export async function householdKnown(owner: MemoryWriter): Promise<HouseholdKnown> {
  const [doc, mode] = await Promise.all([load(owner.storage, owner.me.user), answerFromMemory(owner)]);
  const now = owner.clock.now();
  const facts: Partial<Record<QuestionKey, Known>> = {};
  for (const key of QuestionKey.options) {
    const d = doc.facts[key];
    if (d) facts[key] = known(d, now);
  }
  return {
    mode,
    facts,
    ...(doc.area ? { area: { place: doc.area.place, fresh: isFresh(doc.area.on, now) } } : {}),
  };
}
