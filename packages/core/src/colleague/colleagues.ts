import type { ColleagueCard, EngagementId, Lang, UserId } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import type { Received } from "../mail/transport.js";
import { sweepExpired } from "../mentor/link.js";
import { MentorStore } from "../mentor/store.js";
import * as links from "./link.js";
import { receive } from "./receive.js";
import * as referrals from "./referral.js";
import { type ColleagueContext, ColleagueStore, publicView } from "./store.js";
import type { Colleague, ColleagueDeps, ColleagueNoteRecord } from "./types.js";

export {
  type Colleague,
  type ColleagueDeps,
  type ColleagueNoteRecord,
  ColleagueState,
  NoteFrom,
} from "./types.js";

/**
 * Worker to worker on one phone: linking in person by QR, private notes between linked colleagues, suggesting a
 * colleague on a declined request, and the household asking the suggested colleague (round2-spec §3.2).
 */
export class Colleagues {
  private readonly c: ColleagueContext;

  /** `store` is shared with the mentor code, whose links are colleague links too, so both queue on one store. */
  constructor(deps: ColleagueDeps, store = new ColleagueStore(deps.ctx.storage)) {
    this.c = { ...deps, store };
  }

  /** The parts the mentor code works with: mentor links are colleague links. */
  get context(): ColleagueContext {
    return this.c;
  }

  /** A fresh single-use code, valid for LINK_CODE_TTL_MS, as the QR text that carries it. */
  async invite(card: ColleagueCard): Promise<string> {
    return links.invite(this.c, card);
  }

  /**
   * Asks the phone that showed `payload` to link; refuses its own code and a malformed one (ColleagueError). An
   * expired or used code is refused by the other phone, silently: the colleague then stays `asked`.
   */
  async link(payload: string, card: ColleagueCard): Promise<Colleague> {
    return links.link(this.c, payload, card);
  }

  /**
   * Every colleague, asked or linked, by name: mentor links that have run out are closed here as they are found, and
   * anyone blocked on this phone is left out.
   */
  async list(): Promise<Colleague[]> {
    const [live, blocked] = await Promise.all([
      sweepExpired(this.c.store, this.c.ctx.clock.now()),
      new MentorStore(this.c.ctx.storage).blocked(),
    ]);
    return live
      .filter((c) => !blocked.has(c.user))
      .map(publicView)
      .sort((a, b) => a.card.name.localeCompare(b.card.name));
  }

  async send(user: UserId, text: string, lang: Lang): Promise<void> {
    await links.send(this.c, user, text, lang);
  }

  /** Both sides' notes with one colleague, oldest first. */
  async notes(user: UserId): Promise<ColleagueNoteRecord[]> {
    return this.c.store.notes(user);
  }

  /** Marks a colleague's notes as shown. */
  async read(user: UserId): Promise<void> {
    await this.c.store.update(user, (old) => old && { ...old, unread: 0 });
  }

  /** Ends the link on both phones and deletes its notes here. */
  async unlink(user: UserId): Promise<void> {
    await links.unlink(this.c, user);
  }

  /** True when every active device of `user` understands colleague and referral envelopes (COLLEAGUE_PROTOCOL). */
  async canReach(user: UserId): Promise<boolean> {
    return links.canReach(this.c.relay, user);
  }

  /** On a request this phone declined as provider: suggests a linked colleague to the household. */
  async suggest(id: EngagementId, colleague: UserId): Promise<JobRecord> {
    return referrals.suggest(this.c, id, colleague);
  }

  /** On the household's phone: sends the same need, as a fresh request, to the colleague a worker suggested. */
  async askReferred(id: EngagementId): Promise<JobRecord[]> {
    return referrals.askReferred(this.c.ctx, id);
  }

  /** Takes one colleague envelope the device received. The device's sync calls this; screens do not. */
  async receive(item: Received): Promise<void> {
    await receive(this.c, item);
  }
}
