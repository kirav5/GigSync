import {
  type City,
  type ColleagueCard,
  type EngagementId,
  type MentorProfile,
  MentorReply,
  type ReportReason,
  type UserId,
} from "@gigsync/protocol";
import * as links from "../colleague/link.js";
import type { ColleagueContext } from "../colleague/store.js";
import type { Colleague } from "../colleague/types.js";
import { t } from "../i18n/t.js";
import type { Received } from "../mail/transport.js";
import type { MentorContext } from "./context.js";
import type { MentorRecord } from "./eligibility.js";
import { MentorError, MentorRefusal } from "./errors.js";
import * as intro from "./intro.js";
import { renew } from "./link.js";
import * as listing from "./listing.js";
import * as match from "./match.js";
import { receive } from "./receive.js";
import * as requests from "./request.js";
import * as safety from "./safety.js";
import { MentorStore } from "./store.js";
import {
  type Introduction,
  type MentorApi,
  type MentorChoices,
  type NewcomerPrefs,
  type ReceivedRequest,
  RequestState,
  type SentRequest,
} from "./types.js";

const newestFirst = (a: { at: string }, b: { at: string }) => b.at.localeCompare(a.at);

/**
 * Mentors for someone new to a city, with no steward or union to wait for (round4-spec §2): introductions through
 * linked colleagues, and mentors who list themselves once their own record shows enough signed work. The newcomer
 * browses and picks; the server only filters; no model picks anyone. Either way ends in a 30-day mentor link.
 */
export class Mentors {
  private readonly m: MentorContext;

  constructor(colleagues: ColleagueContext, api?: MentorApi) {
    this.m = { c: colleagues, store: new MentorStore(colleagues.ctx.storage), ...(api ? { api } : {}) };
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
  /** Asks a linked colleague, as a note in the owner's language, whether they know someone in `city`. */
  askAround(user: UserId, city: City): Promise<void> {
    const lang = this.m.c.ctx.lang;
    const text = t(lang, "mentor.intro_ask_note", { city: t(lang, `mentor.city.${city}`) });
    return links.send(this.m.c, user, text, lang);
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
  /** Another 30 days on a live mentor link, on both phones. */
  renew(user: UserId): Promise<Colleague> {
    return renew(this.m, user);
  }

  block(user: UserId): Promise<void> {
    return safety.block(this.m, user);
  }

  report(user: UserId, reason: ReportReason): Promise<void> {
    return safety.report(this.m, user, reason);
  }

  /** Takes one mentor envelope the device received. The device's sync calls this; screens do not. */
  receive(item: Received): Promise<void> {
    return receive(this.m, item);
  }
}
