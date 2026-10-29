import { type CityGuide, type GuideSection, JourneyStep } from "@gigsync/protocol";

/**
 * What to do at each step of a move: the guide's sections for that step, read as written, plus a few fixed items the
 * app adds for every city (they say what to do, never a fact about a city: facts come from the guide).
 */

/** The app's own items. Their words are `landing.fixed_<item>` in each language. */
export const FixedItem = {
  money: "money",
  documents: "documents",
  tell_home: "tell_home",
  share_trip: "share_trip",
  save_address: "save_address",
  rent_receipt: "rent_receipt",
  no_deposit_unseen: "no_deposit_unseen",
  copies: "copies",
  card_area: "card_area",
  first_job: "first_job",
  help_next: "help_next",
} as const;
export type FixedItem = (typeof FixedItem)[keyof typeof FixedItem];

const F = FixedItem;
const S = JourneyStep.enum;

/** The fixed items of each step, in the order shown, after the guide's sections. */
const FIXED: Readonly<Record<JourneyStep, readonly FixedItem[]>> = {
  [S.planning]: [F.money, F.documents, F.tell_home],
  [S.travelling]: [F.share_trip],
  [S.arrived]: [F.save_address],
  [S.housed]: [F.rent_receipt, F.no_deposit_unseen],
  [S.documented]: [F.copies],
  [S.registered]: [],
  [S.working]: [F.card_area, F.first_job],
  [S.settled]: [F.help_next],
};

/** What an item is: a guide section, or one of the app's own. */
export const ItemKind = { section: "section", fixed: "fixed" } as const;
export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];

export type ChecklistItem =
  | { id: string; kind: typeof ItemKind.section; section: GuideSection }
  | { id: string; kind: typeof ItemKind.fixed; item: FixedItem };

const SECTION_PREFIX = "section:";
const FIXED_PREFIX = "fixed:";
export const sectionItem = (id: string): string => `${SECTION_PREFIX}${id}`;
export const fixedItem = (item: FixedItem): string => `${FIXED_PREFIX}${item}`;
/** The item the app ticks by itself when a job both sides signed in the new city is on the phone. */
export const FIRST_JOB_ITEM = fixedItem(F.first_job);

/** One step's checklist: the guide's sections for it, in the guide's order, then the fixed items. */
export function checklist(guide: CityGuide, step: JourneyStep): ChecklistItem[] {
  const sections = guide.sections
    .filter((s) => s.step === step)
    .map((section) => ({ id: sectionItem(section.id), kind: ItemKind.section, section }) as const);
  const fixed = FIXED[step].map((item) => ({ id: fixedItem(item), kind: ItemKind.fixed, item }) as const);
  return [...sections, ...fixed];
}

/** How many of a step's items are ticked. */
export function stepProgress(
  guide: CityGuide,
  step: JourneyStep,
  ticked: Readonly<Record<string, unknown>>,
): { done: number; total: number } {
  const items = checklist(guide, step);
  return { done: items.filter((i) => ticked[i.id] !== undefined).length, total: items.length };
}
