import {
  type EngagementId,
  type Lang,
  type Place,
  QuestionKey,
  type Role,
  type Trade,
  type UserId,
} from "@gigsync/protocol";
import type { Clock, Storage } from "../ports.js";

/**
 * What the agent remembers from past jobs, so the next time it talks for its owner it need not ask again. It lives
 * only on this phone, one document per owner, is listed and forgettable in Profile, and is wiped at sign-out.
 *
 * Never kept: the other side's phone or address (their name only), payment references, and anything from a job that
 * both sides did not sign, except the owner's own facts.
 */

const Q = QuestionKey.enum;

/** Details about a home that stay true from one job to the next, so a remembered value can answer them again. */
export const STABLE_FACTS: ReadonlySet<QuestionKey> = new Set([
  Q.rooms,
  Q.pets,
  Q.people,
  Q.meals,
  Q.area_sqft,
  Q.route,
]);

/** One remembered value with the date it was last given (`YYYY-MM-DD`). */
export interface Dated {
  value: string;
  on: string;
}

/** Someone this owner did a signed job with. */
export interface Person {
  user: UserId;
  /** Their side in the jobs with this owner: a household (requester) or a worker (provider). */
  role: Role;
  /** Their name from the contact card, once it arrived; never their phone or address. */
  name?: string;
  trades: Trade[];
  jobs: number;
  /** Worker side: the stable details this household gave, newest per key, and the language they wrote them in. */
  details: Partial<Record<QuestionKey, Dated>>;
  lang?: Lang;
  /** For the owner's own screen only: never in `recall` or `summary`, never in a prompt. */
  last_price_paise?: number;
  /** The date of the last signed job together. */
  last_on: string;
}

/** A question the worker's agent asked for a trade: a standard key, or the text its model wrote. */
export interface Asked {
  key: string;
  text?: string;
  /** The language `text` is written in, so the screen can translate it. */
  lang?: Lang;
  answered: boolean;
  on: string;
}

/** The whole memory of one owner: one storage document. */
export interface MemoryDoc {
  owner: UserId;
  /** Household side: the owner's own stable facts. */
  facts: Partial<Record<QuestionKey, Dated>>;
  /** Household side: where the last job was, as the approximate place the request used. */
  area?: { place: Place; on: string };
  people: Record<string, Person>;
  /** Worker side: what was asked per trade, newest first. */
  asked: Partial<Record<Trade, Asked[]>>;
  /** Jobs already counted, so remembering one twice (agreed, then the card arrives) counts it once. */
  counted: EngagementId[];
}

/** What `recall` gives the agent's prompts and auto-answers. Prices are left out on purpose. */
export interface Recall {
  /** The owner's own stable facts (household side): what the household's agent may answer from. */
  facts: Partial<Record<QuestionKey, string>>;
  /** The counterpart, when this owner did a signed job with them before. */
  person?: {
    name?: string;
    role: Role;
    jobs: number;
    trades: Trade[];
    /** Worker side: what this household told this worker before. */
    details: Partial<Record<QuestionKey, string>>;
    last_on: string;
  };
  /** Worker side: questions asked before for this trade, newest first. */
  askedBefore: Asked[];
}

/** One line of the Profile list; `key` is what `forgetMemory` takes. */
export const MemoryItemKind = {
  fact: "fact",
  area: "area",
  person: "person",
  asked: "asked",
} as const;
export type MemoryItemKind = (typeof MemoryItemKind)[keyof typeof MemoryItemKind];

export type MemoryItem =
  | { kind: typeof MemoryItemKind.fact; key: string; fact: QuestionKey; value: string; on: string }
  | { kind: typeof MemoryItemKind.area; key: string; place: Place; on: string }
  | { kind: typeof MemoryItemKind.person; key: string; person: Person }
  | { kind: typeof MemoryItemKind.asked; key: string; trade: Trade; asked: Asked[] };

/** `forgetMemory(owner, FORGET_ALL)` clears everything this owner's agent remembers. */
export const FORGET_ALL = "all";

/** Whose memory, on which storage. `JobContext` satisfies it, so job code passes its context as is. */
export interface MemoryOwner {
  storage: Storage;
  me: { user: UserId };
}

/** Remembering also needs the date. */
export interface MemoryWriter extends MemoryOwner {
  clock: Clock;
}
