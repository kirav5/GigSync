import { Lang, MAX_MENTOR_SLOTS, Trade } from "@gigsync/protocol";
import type { ListingChoices } from "../mentor/listing.js";

/**
 * Offering to help newcomers, asked in Talk as short questions instead of a form: the area the owner knows, the work
 * they can tell newcomers about (only when their card has more than one trade), the languages they speak, whether
 * they are a woman, whether they help women newcomers only (only for a woman), how many newcomers at a time, then a
 * summary to confirm before anything is published. The draft travels with the chat's turns, so the questions carry on
 * after a restart; the publish itself is `Mentors.publish`, refused unless the phone's record reaches the minimum.
 */

export const ListingStep = {
  area: "area",
  trades: "trades",
  languages: "languages",
  woman: "woman",
  womenOnly: "women_only",
  slots: "slots",
  confirm: "confirm",
} as const;
export type ListingStep = (typeof ListingStep)[keyof typeof ListingStep];
const S = ListingStep;
const ORDER: readonly ListingStep[] = [S.area, S.trades, S.languages, S.woman, S.womenOnly, S.slots, S.confirm];
/** Steps answered by tapping several chips, then "Done". */
export const MULTI_STEPS: ReadonlySet<ListingStep> = new Set([S.trades, S.languages]);

/** The listing so far, and the steps already answered. */
export interface ListingDraft {
  choices: ListingChoices;
  asked: readonly ListingStep[];
}

/** One answer: a choice for a step, a chip toggled on a step that takes several, or "Done" on one of those. */
export type ListingAnswer =
  | { step: typeof S.area; area: string }
  | { step: typeof S.trades; trade: Trade }
  | { step: typeof S.languages; lang: Lang }
  | { step: typeof S.woman; woman: boolean }
  | { step: typeof S.womenOnly; on: boolean }
  | { step: typeof S.slots; slots: number }
  | { step: typeof S.trades | typeof S.languages; done: true };

/** Longest area name a listing takes (the protocol's limit). */
const AREA_MAX = 60;

export const startListing = (choices: ListingChoices): ListingDraft => ({ choices, asked: [] });

/** A step that does not apply to this owner is never asked. */
function applies(step: ListingStep, draft: ListingDraft, cardTrades: readonly Trade[]): boolean {
  if (step === S.trades) return cardTrades.length > 1;
  if (step === S.womenOnly) return draft.choices.woman;
  return true;
}

/** The next question to ask; `confirm` once every other step is answered. */
export function nextListingStep(draft: ListingDraft, cardTrades: readonly Trade[]): ListingStep {
  return ORDER.find((step) => !draft.asked.includes(step) && applies(step, draft, cardTrades)) ?? S.confirm;
}

const toggled = <T>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

const answeredStep = (draft: ListingDraft, step: ListingStep, choices: ListingChoices): ListingDraft => ({
  choices,
  asked: [...draft.asked, step],
});

/** True when an answer's value is one the listing can hold; a chip read back from an older app may not be. */
function valid(a: ListingAnswer): boolean {
  if ("done" in a) return true;
  switch (a.step) {
    case S.area:
      return a.area.length > 0 && a.area.length <= AREA_MAX;
    case S.trades:
      return Trade.safeParse(a.trade).success;
    case S.languages:
      return Lang.safeParse(a.lang).success;
    case S.slots:
      return Number.isInteger(a.slots) && a.slots >= 1 && a.slots <= MAX_MENTOR_SLOTS;
    default:
      return true;
  }
}

/** The draft with an answer applied; unchanged for a value it cannot hold, or "Done" with nothing picked. */
export function answerListing(draft: ListingDraft, a: ListingAnswer): ListingDraft {
  if (!valid(a)) return draft;
  const c = draft.choices;
  if ("done" in a) {
    const picked = a.step === S.trades ? c.trades : c.languages;
    return picked.length > 0 ? answeredStep(draft, a.step, c) : draft;
  }
  switch (a.step) {
    case S.area:
      return answeredStep(draft, a.step, { ...c, area: a.area });
    case S.trades:
      return { ...draft, choices: { ...c, trades: toggled(c.trades, a.trade) } };
    case S.languages:
      return { ...draft, choices: { ...c, languages: toggled(c.languages, a.lang) } };
    case S.woman:
      return answeredStep(draft, a.step, {
        ...c,
        woman: a.woman,
        women_only_newcomers: a.woman && c.women_only_newcomers,
      });
    case S.womenOnly:
      return answeredStep(draft, a.step, { ...c, women_only_newcomers: c.woman && a.on });
    case S.slots:
      return answeredStep(draft, a.step, { ...c, slots: a.slots });
  }
}

/** The listing can be published: it names at least one trade and one language. */
export const listingReady = (draft: ListingDraft): boolean =>
  draft.choices.trades.length > 0 && draft.choices.languages.length > 0;
