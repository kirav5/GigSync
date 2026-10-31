import { z } from "zod";
import { UPI_MAX_PAISE } from "./payment.js";

/**
 * A city guide for someone moving there for work (agent-flows §3): what to do at each step of the move, numbers to
 * save, places listed from public sources, costs and pay. Served by `GET /v1/content/:city` and kept on the phone.
 * The app reads sections out as written; no model writes guide text, and the cash plan adds `amount_paise`, never
 * parsing the human `amount` text.
 */

/** Cities that have a guide. Adding one is a value here plus its guide file next to the API. */
export const City = z.enum(["bengaluru"]);
export type City = z.infer<typeof City>;

/** The steps of a move, in order. Each guide section belongs to one. */
export const JourneyStep = z.enum([
  "planning",
  "travelling",
  "arrived",
  "housed",
  "documented",
  "registered",
  "working",
  "settled",
]);
export type JourneyStep = z.infer<typeof JourneyStep>;

/** `draft` until a union or worker group has checked it; the app shows the guide's label either way. */
export const GuideStatus = z.enum(["draft", "checked"]);
export type GuideStatus = z.infer<typeof GuideStatus>;

/** What a listed place is. */
export const PlaceKind = z.enum(["housing", "union", "office"]);
export type PlaceKind = z.infer<typeof PlaceKind>;

const MAX_SECTIONS = 100;
const MAX_ITEMS = 100;
const MAX_SOURCES = 10;
const MAX_KEYWORDS = 30;
const MAX_TITLE = 200;
const MAX_TEXT = 1000;
const MAX_BODY = 2000;
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const day = z.iso.date();
const url = z.url();
const title = z.string().min(1).max(MAX_TITLE);
const text = z.string().min(1).max(MAX_TEXT);
const year = z.number().int().min(MIN_YEAR).max(MAX_YEAR);
/** A section id: lowercase words joined by hyphens, e.g. `bus-travel`. */
export const SectionId = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "section id");
export type SectionId = z.infer<typeof SectionId>;

/** A public page a section was written from, and the day it was read. */
export const GuideSource = z.object({ title, url, read: day });
export type GuideSource = z.infer<typeof GuideSource>;

export const GuideSection = z.object({
  id: SectionId,
  step: JourneyStep,
  title,
  body: z.string().min(1).max(MAX_BODY),
  /** Words to say or show at a counter, for the "copy what to say" button. */
  quote: text.optional(),
  sources: z.array(GuideSource).min(1).max(MAX_SOURCES),
  /** What a question must contain for "Ask the guide" to answer with this section. */
  keywords: z.array(z.string().min(1).max(MAX_TITLE)).min(1).max(MAX_KEYWORDS),
});
export type GuideSection = z.infer<typeof GuideSection>;

export const Helpline = z.object({
  name: title,
  /** As dialled: digits, optionally with a leading + and spaces. */
  number: z.string().regex(/^\+?[0-9 ]{3,20}$/, "phone number"),
  source: url,
});
export type Helpline = z.infer<typeof Helpline>;

export const GuidePlace = z.object({ kind: PlaceKind, name: title, area: title, detail: text, source: url });
export type GuidePlace = z.infer<typeof GuidePlace>;

/** Pay as found in public sources: text for people, never used for arithmetic. */
export const GuideRate = z.object({
  work: title,
  amount: title,
  unit: title,
  area: title,
  year,
  what_it_is: text,
  source: url,
});
export type GuideRate = z.infer<typeof GuideRate>;

/** A cost. `amount_paise` is there when the cost is one number (0 when free); a range carries its upper bound. */
/** How often a cost is paid; a cost without one is paid once. */
export const CostPer = z.enum(["once", "day", "week", "month"]);
export type CostPer = z.infer<typeof CostPer>;

export const GuideCost = z.object({
  item: title,
  amount: title,
  amount_paise: z.number().int().nonnegative().max(UPI_MAX_PAISE).optional(),
  per: CostPer.optional(),
  /** Costs sharing a choice are ways to pay for one thing (a day, week or month bus pass): only the cheapest counts. */
  choice: SectionId.optional(),
  year,
  detail: text,
  source: url,
});
export type GuideCost = z.infer<typeof GuideCost>;

/** `GET /v1/content/:city`: the whole guide. */
export const CityGuide = z.object({
  city: City,
  status: GuideStatus,
  drafted: day,
  /** Shown on every screen that shows the guide, e.g. "Draft from public sources. Not yet checked by a union." */
  label: title,
  sections: z.array(GuideSection).min(1).max(MAX_SECTIONS),
  helplines: z.array(Helpline).max(MAX_ITEMS),
  places: z.array(GuidePlace).max(MAX_ITEMS),
  rates: z.array(GuideRate).max(MAX_ITEMS),
  costs: z.array(GuideCost).max(MAX_ITEMS),
  /** What the guide's authors could not confirm; the app lists it under "Not yet checked". */
  needs_checking: z.array(text).max(MAX_ITEMS),
});
export type CityGuide = z.infer<typeof CityGuide>;
