import type { ColleagueCard, EngagementId, Lang, UserId } from "@gigsync/protocol";
import type { JobContext } from "../job/context.js";
import type { JobRecord } from "../job/store.js";
import type { MailTransport } from "../mail/transport.js";
import type { Relay } from "../net/api.js";
import { NotBuiltError } from "../not-built.js";

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

/**
 * Worker to worker on one phone: linking in person by QR, private notes between linked colleagues, suggesting a
 * colleague on a declined request, and the household asking the suggested colleague (round2-spec §3.2).
 */
export class Colleagues {
  constructor(private readonly deps: ColleagueDeps) {}

  /** A fresh single-use code, valid for LINK_CODE_TTL_MS, as the QR text that carries it. */
  async invite(_card: ColleagueCard): Promise<string> {
    void this.deps;
    throw new NotBuiltError("Colleagues.invite");
  }

  /** Asks the phone that showed `payload` to link; refuses its own code and an expired or malformed one. */
  async link(_payload: string, _card: ColleagueCard): Promise<Colleague> {
    throw new NotBuiltError("Colleagues.link");
  }

  async list(): Promise<Colleague[]> {
    throw new NotBuiltError("Colleagues.list");
  }

  async send(_user: UserId, _text: string, _lang: Lang): Promise<void> {
    throw new NotBuiltError("Colleagues.send");
  }

  /** Both sides' notes with one colleague, oldest first. */
  async notes(_user: UserId): Promise<ColleagueNoteRecord[]> {
    throw new NotBuiltError("Colleagues.notes");
  }

  /** Marks a colleague's notes as shown. */
  async read(_user: UserId): Promise<void> {
    throw new NotBuiltError("Colleagues.read");
  }

  /** Ends the link on both phones and deletes its notes here. */
  async unlink(_user: UserId): Promise<void> {
    throw new NotBuiltError("Colleagues.unlink");
  }

  /** True when every active device of `user` understands colleague and referral envelopes (COLLEAGUE_PROTOCOL). */
  async canReach(_user: UserId): Promise<boolean> {
    throw new NotBuiltError("Colleagues.canReach");
  }

  /** On a request this phone declined as provider: suggests a linked colleague to the household. */
  async suggest(_id: EngagementId, _colleague: UserId): Promise<JobRecord> {
    throw new NotBuiltError("Colleagues.suggest");
  }

  /** On the household's phone: sends the same need, as a fresh request, to the colleague a worker suggested. */
  async askReferred(_id: EngagementId): Promise<JobRecord[]> {
    throw new NotBuiltError("Colleagues.askReferred");
  }
}
