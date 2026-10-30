import {
  type CityGuide,
  type GuidePlace,
  type GuideSection,
  JourneyStep,
  Lang,
  PlaceKind,
  type SectionId,
} from "@gigsync/protocol";
import { normalize } from "../interview/normalize.js";
import { askGuide, type FoundBy, findSection } from "../landing/ask.js";
import { GuideNeed, needsIn } from "../landing/ask-words.js";
import { FixedItem } from "../landing/checklist.js";
import type { Model } from "../ports.js";

/**
 * What Talk answers from a city's guide while a chat is about a move: what to sort first, where to stay, documents,
 * and the owner's own questions. Every word shown is the guide's (sections, places, sources) or the app's own fixed
 * advice; a model may only pick a section (`askGuide`), never write any of it.
 */

/** A guide section named in a list: its id, and its title as the guide writes it. */
export interface SectionRef {
  id: SectionId;
  title: string;
}

/** A reply from the guide: one section as written, the places it lists for it, or a list of sections to pick from. */
export interface GuideReply {
  section?: GuideSection | undefined;
  places?: readonly GuidePlace[] | undefined;
  topics?: readonly SectionRef[] | undefined;
  /** How the section was found, when it answers a question. */
  by?: FoundBy | undefined;
}

/** What to sort first after arriving, in this order: a place to stay, a SIM, a bank account, documents, registration. */
const FIRST_NEEDS: readonly GuideNeed[] = [
  GuideNeed.stay,
  GuideNeed.sim,
  GuideNeed.bank,
  GuideNeed.aadhaar,
  GuideNeed.eshram,
];

const refOf = (s: GuideSection): SectionRef => ({ id: s.id, title: s.title });

/** The section the guide has for a need, found as a question naming it in English would find it. */
const sectionFor = (guide: CityGuide, need: GuideNeed) => findSection(guide, need, Lang.enum.en);

/** The guide's sections for what to sort first, one per need, each once, in the order above. */
export function firstSteps(guide: CityGuide): SectionRef[] {
  const found = FIRST_NEEDS.flatMap((need) => sectionFor(guide, need) ?? []);
  return [...new Map(found.map((s) => [s.id, refOf(s)])).values()];
}

/** "Where to stay": the guide's section on a place to stay, and the places it lists to stay in. */
export function stayReply(guide: CityGuide): GuideReply {
  const places = guide.places.filter((p) => p.kind === PlaceKind.enum.housing);
  return { section: sectionFor(guide, GuideNeed.stay), places };
}

/** "Documents": the guide's sections for the documents step, to open one by one. */
export function documentsReply(guide: CityGuide): GuideReply {
  return { topics: guide.sections.filter((s) => s.step === JourneyStep.enum.documented).map(refOf) };
}

/** One section by its id, when a list's entry is tapped; nothing when the guide no longer has it. */
export function sectionReply(guide: CityGuide, id: string): GuideReply {
  return { section: guide.sections.find((s) => s.id === id) };
}

/** True when the words ask something the guide is about (a room, a bank, a SIM…), in any of the app's languages. */
export const asksGuide = (text: string, lang: Lang): boolean => needsIn(normalize(text), lang).length > 0;

/**
 * The owner's question answered from the guide: its section as written (with the places to stay when the question is
 * about a place to stay), or undefined when the guide has nothing on it.
 */
export async function questionReply(
  guide: CityGuide,
  question: string,
  options: { lang: Lang; model?: Model; waitMs?: number },
): Promise<GuideReply | undefined> {
  const answer = await askGuide(guide, question, options);
  if (!answer) return undefined;
  const stay = sectionFor(guide, GuideNeed.stay);
  const places = answer.section.id === stay?.id ? stayReply(guide).places : undefined;
  return { section: answer.section, places, by: answer.by };
}

/** What helps in any city, from the app's own checklist items (their words are `landing.fixed_<item>`). */
export const GENERAL_STEPS: readonly FixedItem[] = [
  FixedItem.money,
  FixedItem.documents,
  FixedItem.tell_home,
  FixedItem.share_trip,
  FixedItem.save_address,
  FixedItem.no_deposit_unseen,
  FixedItem.rent_receipt,
  FixedItem.copies,
];

/** A helpline that works anywhere in India: its number as dialled, and the official page it is listed on. */
export interface NationalLine {
  /** Its words are `moving.line.<name>`. */
  name: "emergency" | "women" | "eshram" | "cyber" | "legal";
  number: string;
  source: string;
}

/**
 * Numbers that work in every city, for a move to a city without a guide: 112 with the national emergency service's
 * page, the others with the pages the Bengaluru guide cites for them.
 */
export const NATIONAL_LINES: readonly NationalLine[] = [
  { name: "emergency", number: "112", source: "https://112.gov.in/" },
  { name: "women", number: "181", source: "https://wcd.gov.in/" },
  { name: "eshram", number: "14434", source: "https://eshram.gov.in/indexmain" },
  { name: "cyber", number: "1930", source: "https://i4c.mha.gov.in/" },
  { name: "legal", number: "15100", source: "https://nalsa.gov.in/" },
];
