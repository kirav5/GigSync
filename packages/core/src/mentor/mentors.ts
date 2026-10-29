import {
  type City,
  type ColleagueCard,
  type EngagementId,
  type Lang,
  type MentorProfile,
  MentorReply,
  type ReportReason,
  type UserId,
} from "@gigsync/protocol";
import type { Received } from "../mail/transport.js";
import { askAround } from "./ask.js";
import type { MentorContext, MentorDeps } from "./context.js";
import type { MentorRecord } from "./eligibility.js";
import { MentorError, MentorRefusal } from "./errors.js";
import * as intro from "./intro.js";
import { type KnownPerson, people } from "./known.js";
import * as link from "./link.js";
import { LinkStore } from "./link-store.js";
import * as listing from "./listing.js";
import * as match from "./match.js";
import { receive } from "./receive.js";
import * as requests from "./request.js";
import * as safety from "./safety.js";
import { MentorStore } from "./store.js";
import {
  type Introduction,
  type LinkNote,
  type MentorApi,
  type MentorChoices,
  type MentorLink,
  type NewcomerPrefs,
  type ReceivedRequest,
  RequestState,
  type SentRequest,
} from "./types.js";

export type { KnownPerson } from "./known.js";

const newestFirst = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);

/**
 * Mentors for someone new to a city, with no steward or union to wait for (round4-spec §2): introductions by someone
 * who knows both sides (a job each signed with them, or a mentor link), and mentors who list themselves once their own
 * record shows enough signed work. The newcomer browses and picks; the server only filters; no model picks anyone.
 * Either way ends in a 30-day mentor link, with notes both ways until it runs out.
 */
export class Mentors {
  private readonly m: MentorContext;

  constructor(deps: MentorDeps, api?: MentorApi) {
    const storage = deps.ctx.storage;
    this.m = { ...deps, links: new LinkStore(storage), store: new MentorStore(storage), ...(api ? { api } : {}) };
  }

  // ── Mentor ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** This phone's own count of finished jobs both sides signed, and whether it reaches the minimum. */
  record(): Promise<MentorRecord> {
    return listing.myRecord(this.m);
  }

  choices(): Promise<MentorChoices | undefined> {
    return this.m.store.choices();
  }

  /** Lists this owner as a mentor; refused (`not_eligible`) until their record reaches the minimum. */
  publish(choices: listing.ListingChoices): Promise<MentorChoices> {
    return listing.publish(this.m, choices);
  }

  unpublish(): Promise<void> {
    return listing.unpublish(this.m);
  }

  /** Landing requests waiting for this owner's yes or no, newest first: Today's decisions. */
  async incoming(): Promise<ReceivedRequest[]> {
    const [all, blocked] = await Promise.all([this.m.store.received(), this.m.store.blocked()]);
    return all.filter((r) => r.state === RequestState.sent && !blocked.has(r.from)).sort(newestFirst);
  }

  offer(channel: EngagementId, card: ColleagueCard, note?: string): Promise<void> {
    return requests.offer(this.m, channel, card, note);
  }

  decline(channel: EngagementId): Promise<void> {
    return requests.decline(this.m, channel);
  }

  // ── Newcomer ────────────────────────────────────────────────────────────────────────────────────────────────────
  async newcomer(): Promise<NewcomerPrefs> {
    return (await this.m.store.newcomer()) ?? {};
  }

  answerWoman(woman: boolean): Promise<NewcomerPrefs> {
    return match.answerWoman(this.m, woman);
  }

  setWomenOnly(on: boolean): Promise<NewcomerPrefs> {
    return match.setWomenOnly(this.m, on);
  }

  safetySeen(): Promise<NewcomerPrefs> {
    return match.safetySeen(this.m);
  }

  find(filters: match.MentorFilters): Promise<MentorProfile[]> {
    return match.findMentors(this.m, filters);
  }

  request(
    picks: readonly MentorProfile[],
    ask: requests.LandingAsk,
    card: ColleagueCard,
  ): Promise<{ sent: SentRequest[]; tooOld: MentorProfile[] }> {
    return requests.sendRequests(this.m, picks, ask, card);
  }

  /** This newcomer's requests and the answers to them, newest first, leaving out anyone blocked. */
  async requests(): Promise<SentRequest[]> {
    const [all, blocked] = await Promise.all([this.m.store.sent(), this.m.store.blocked()]);
    return all.filter((r) => !blocked.has(r.mentor)).sort(newestFirst);
  }

  confirm(channel: EngagementId): Promise<void> {
    return requests.confirm(this.m, channel);
  }

  /** Gives up on one request still open. */
  async cancel(channel: EngagementId): Promise<void> {
    const r = await this.m.store.sentOn(channel);
    if (!r || !requests.isOpenRequest(r)) throw new MentorError(MentorRefusal.notFound);
    await requests.withdraw(this.m, r);
  }

  // ── Introductions ───────────────────────────────────────────────────────────────────────────────────────────────
  /** Everyone this owner knows through a signed job or a mentor link: whom they may ask, or introduce. */
  people(): Promise<KnownPerson[]> {
    return people(this.m);
  }

  /** Asks someone this owner knows, in the owner's language, whether they know someone in `city`. */
  askAround(user: UserId, city: City): Promise<void> {
    return askAround(this.m, user, city);
  }

  introduce(pair: { newcomer: UserId; mentor: UserId; city: City; note?: string }): Promise<void> {
    return intro.introduce(this.m, pair);
  }

  /** Introductions still waiting for this owner's answer, or for the other person's, newest first. */
  async intros(): Promise<Introduction[]> {
    const [all, blocked] = await Promise.all([this.m.store.intros(), this.m.store.blocked()]);
    const pending = (i: Introduction) =>
      i.mine === undefined || (i.mine === MentorReply.enum.accept && i.theirs === undefined);
    return all.filter((i) => pending(i) && !blocked.has(i.other)).sort(newestFirst);
  }

  answerIntro(channel: EngagementId, reply: MentorReply): Promise<void> {
    return intro.answerIntro(this.m, channel, reply);
  }

  // ── Links and safety ────────────────────────────────────────────────────────────────────────────────────────────
  /** Live mentor links by name; links that ran out end here as they are found, and anyone blocked is left out. */
  async links(): Promise<MentorLink[]> {
    const [live, blocked] = await Promise.all([
      link.sweepExpired(this.m.links, this.m.ctx.clock.now()),
      this.m.store.blocked(),
    ]);
    return live.filter((l) => !blocked.has(l.user)).sort((a, b) => a.card.name.localeCompare(b.card.name));
  }

  /** Both sides' notes on one link, oldest first. */
  notes(user: UserId): Promise<LinkNote[]> {
    return this.m.links.notes(user);
  }

  /** Marks one link's notes as shown. */
  async read(user: UserId): Promise<void> {
    await this.m.links.update(user, (old) => old && { ...old, unread: 0 });
  }

  send(user: UserId, text: string, lang: Lang): Promise<void> {
    return link.sendNote(this.m, user, text, lang);
  }

  /** Ends a link on both phones and deletes its notes here. */
  end(user: UserId): Promise<void> {
    return link.endLink(this.m, user);
  }

  /** Another 30 days on a live mentor link, on both phones. */
  renew(user: UserId): Promise<MentorLink> {
    return link.renew(this.m, user);
  }

  block(user: UserId): Promise<void> {
    return safety.block(this.m, user);
  }

  report(user: UserId, reason: ReportReason): Promise<void> {
    return safety.report(this.m, user, reason);
  }

  /** Takes one mentor or link envelope the device received. The device's sync calls this; screens do not. */
  receive(item: Received): Promise<void> {
    return receive(this.m, item);
  }
}
