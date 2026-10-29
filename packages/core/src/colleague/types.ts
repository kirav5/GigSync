import type { ColleagueCard, EngagementId, Lang, LinkKind, UserId } from "@gigsync/protocol";
import type { JobContext } from "../job/context.js";
import type { MailTransport } from "../mail/transport.js";
import type { MentorSide } from "../mentor/types.js";
import type { Relay } from "../net/api.js";

/** A colleague link waits for the other phone (`asked`) until its `ok` arrives (`linked`). */
export const ColleagueState = { asked: "asked", linked: "linked" } as const;
export type ColleagueState = (typeof ColleagueState)[keyof typeof ColleagueState];

/** Who wrote a colleague note, as this phone sees it. */
export const NoteFrom = { me: "me", them: "them" } as const;
export type NoteFrom = (typeof NoteFrom)[keyof typeof NoteFrom];

/** A worker this phone linked with in person. */
export interface Colleague {
  user: UserId;
  card: ColleagueCard;
  /** The pair's channel: every envelope between the two carries it as its `engagement`. */
  channel: EngagementId;
  state: ColleagueState;
  linked_at?: string;
  /** Notes from them this phone has not shown yet. */
  unread: number;
  /** `mentor` for a link opened through an introduction or a landing request; absent for one made in person. */
  kind?: LinkKind;
  /** When a mentor link closes, unless either side renews it. */
  expires_at?: string;
  /** A mentor link's sides and the mentor's own record. */
  mentor?: MentorSide;
}

/** One message between two colleagues, with the language it was written in. */
export interface ColleagueNoteRecord {
  id: string;
  from: NoteFrom;
  text: string;
  lang: Lang;
  at: string;
}

/** What the colleague code needs from the device it lives on. */
export interface ColleagueDeps {
  ctx: JobContext;
  transport: MailTransport;
  relay: Relay;
}
