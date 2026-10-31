import type { ArrivalWeeks, FoundBy, Line, ListingAnswer, ListingDraft, SectionRef } from "@gigsync/core";
import { City, GuidePlace, GuideSection, MentorProfile, type Trade, type UserId } from "@gigsync/protocol";

/**
 * The turns a chat about moving to a new city holds (ADR 0035 keeps chats of any kind of turn): the move itself (what
 * to sort first, and the buttons), the work outlook, an answer from the city's guide, mentors to ask, and the agent's
 * short questions with tap answers (are you a woman, when do you arrive, the listing choices). Each is the agent's;
 * the owner's own words in these flows are notes, so they title the chat and stay when a card interview closes.
 */

export const MoveSpeaker = {
  moving: "moving",
  outlook: "outlook",
  guide: "guide",
  mentors: "mentors",
  agent: "agent",
} as const;
const MOVE_SPEAKERS: ReadonlySet<string> = new Set(Object.values(MoveSpeaker));

/** What a tap on one of the agent's chips does. */
export const ActKind = {
  trade: "trade",
  woman: "woman",
  safety: "safety",
  arrive: "arrive",
  section: "section",
  listing: "listing",
  publish: "publish",
  notNow: "not_now",
  moreWays: "more_ways",
} as const;
const ACT_KINDS: ReadonlySet<string> = new Set(Object.values(ActKind));

export type Act =
  | { kind: typeof ActKind.trade; trade: Trade }
  | { kind: typeof ActKind.woman; woman: boolean }
  | { kind: typeof ActKind.safety; mentor: UserId }
  | { kind: typeof ActKind.arrive; mentor: UserId; weeks: ArrivalWeeks }
  | { kind: typeof ActKind.section; id: string }
  | { kind: typeof ActKind.listing; answer: ListingAnswer }
  | { kind: typeof ActKind.publish }
  | { kind: typeof ActKind.notNow }
  | { kind: typeof ActKind.moreWays };

/** A chip: its words, what it does, and whether it is picked (on a question that takes several). */
export interface ActChoice {
  label: Line;
  act: Act;
  on?: boolean | undefined;
}

/** An answer from the guide as a chat keeps it: a section as written, places, sections to pick, or that it has none. */
export interface GuideAnswerKept {
  section?: GuideSection | undefined;
  places?: readonly GuidePlace[] | undefined;
  topics?: readonly SectionRef[] | undefined;
  by?: FoundBy | undefined;
  /** The guide has nothing on the question. */
  none?: true | undefined;
}

export type MoveTurn =
  /** The move: to a city with a guide (what to sort first and the buttons), or to one without (`city` undefined). */
  | { id: number; who: typeof MoveSpeaker.moving; city?: City | undefined; steps: readonly SectionRef[] }
  /** The work outlook, and the model's wording of it when that passed the checks. */
  | {
      id: number;
      who: typeof MoveSpeaker.outlook;
      trades: readonly Trade[];
      lines: readonly Line[];
      phrased?: string | undefined;
    }
  | { id: number; who: typeof MoveSpeaker.guide; city: City; answer: GuideAnswerKept }
  | { id: number; who: typeof MoveSpeaker.mentors; city: City; mentors: readonly MentorProfile[] }
  /** A short question or word from the agent; the listing's draft rides on its questions. */
  | {
      id: number;
      who: typeof MoveSpeaker.agent;
      lines: readonly Line[];
      choices: readonly ActChoice[];
      draft?: ListingDraft | undefined;
    };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
const isAct = (value: unknown) => isObject(value) && typeof value.kind === "string" && ACT_KINDS.has(value.kind);
const isChoice = (value: unknown) => isObject(value) && isObject(value.label) && isAct(value.act);
/** Every item of an array fits the schema. */
const all = (value: unknown, schema: { safeParse(v: unknown): { success: boolean } }) =>
  isArray(value) && value.every((v) => schema.safeParse(v).success);

function isAnswer(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { section, places, topics } = value;
  return (
    (section === undefined || GuideSection.safeParse(section).success) &&
    (places === undefined || all(places, GuidePlace)) &&
    (topics === undefined || isArray(topics))
  );
}

/** A turn read back from the phone that has the shape this app writes for a move; guide text and mentors re-checked. */
export function isMoveTurn(value: unknown): value is MoveTurn {
  if (!isObject(value) || typeof value.id !== "number" || typeof value.who !== "string") return false;
  if (!MOVE_SPEAKERS.has(value.who)) return false;
  switch (value.who) {
    case MoveSpeaker.moving:
      return isArray(value.steps) && (value.city === undefined || City.safeParse(value.city).success);
    case MoveSpeaker.outlook:
      return isArray(value.trades) && isArray(value.lines);
    case MoveSpeaker.guide:
      return City.safeParse(value.city).success && isAnswer(value.answer);
    case MoveSpeaker.mentors:
      return City.safeParse(value.city).success && all(value.mentors, MentorProfile);
    default:
      return isArray(value.lines) && isArray(value.choices) && value.choices.every(isChoice);
  }
}

/** True for every turn kind this file adds. */
export const isMove = (turn: { who: string }): turn is MoveTurn => MOVE_SPEAKERS.has(turn.who);
