import {
  type Agree,
  type ColleagueCard,
  type ContactCard,
  type EngagementId,
  MentorListing as ListingSchema,
  MATCH_LIMIT,
  type MatchRequestInput,
  MENTOR_PROTOCOL,
  type MentorListing,
  type MentorListingInput,
  type MentorProfile,
  type MentorReport,
  type MyMentorListing,
  type OfferId,
  REPORT_SUSPEND,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { type Clock, type JobRecord, JobStore, type MentorApi } from "../src/index.js";
import { BENGALURU, type MemoryRelay, type Phone, phone } from "./phones.js";

/** A clock a test moves by hand. */
export class TestClock implements Clock {
  constructor(private at = new Date()) {}
  now(): Date {
    return new Date(this.at);
  }
  advance(ms: number): void {
    this.at = new Date(this.at.getTime() + ms);
  }
}

/**
 * workers/api's mentor routes in memory, matching as the server does: city, trade, language, open slots, women-only
 * both ways round, blocked pairs and reported mentors left out, most jobs first.
 */
export class FakeMentorServer {
  readonly listings = new Map<UserId, MentorListing>();
  readonly reports: (MentorReport & { by: UserId })[] = [];
  readonly blocks: { by: UserId; user: UserId }[] = [];

  /** The routes as one signed-in caller sees them; `caller` names them at each call. */
  for(caller: () => UserId): MentorApi {
    return {
      publishMentor: async (input: MentorListingInput): Promise<MyMentorListing> => {
        const listing = ListingSchema.parse(input);
        this.listings.set(caller(), listing);
        return { listing: { ...listing, vouched_by: null } };
      },
      removeMentor: async () => {
        this.listings.delete(caller());
      },
      matchMentors: async (q: MatchRequestInput) => this.match(caller(), q),
      reportMentor: async (r: MentorReport) => {
        this.reports.push({ ...r, by: caller() });
      },
      blockMentor: async (user: UserId) => {
        this.blocks.push({ by: caller(), user });
      },
    };
  }

  private match(me: UserId, q: MatchRequestInput): MentorProfile[] {
    const blocked = (u: UserId) =>
      this.blocks.some((b) => (b.by === me && b.user === u) || (b.by === u && b.user === me));
    const suspended = (u: UserId) =>
      new Set(this.reports.filter((r) => r.user === u).map((r) => r.by)).size >= REPORT_SUSPEND;
    return [...this.listings.entries()]
      .filter(([user, l]) => {
        if (user === me || blocked(user) || suspended(user) || !l.active || l.open_slots === 0) return false;
        if (l.city !== q.city || !l.trades.includes(q.trade) || !l.languages.includes(q.lang)) return false;
        if (q.women_only && !l.woman) return false;
        return !(l.woman && l.women_only_newcomers && !q.woman);
      })
      .sort(([, a], [, b]) => b.jobs - a.jobs)
      .slice(0, MATCH_LIMIT)
      .map(([user, l]) => ({
        user,
        first_name: l.first_name,
        city: l.city,
        area: l.area,
        trades: l.trades,
        languages: l.languages,
        months: l.months,
        jobs: l.jobs,
        vouched_by: null,
      }));
  }
}

/** A phone on the mentor protocol, with the fake server's routes and the test's clock. */
export async function mentorPhone(relay: MemoryRelay, server: FakeMentorServer, contact: ContactCard, clock: Clock) {
  // The phone makes its user id; the routes ask for it only when called, by which time it is known.
  const caller: { user?: UserId } = {};
  const mentorApi = server.for(() => {
    if (!caller.user) throw new Error("no caller yet");
    return caller.user;
  });
  const p = await phone(relay, contact, { protocol: MENTOR_PROTOCOL, clock, mentorApi });
  caller.user = p.user;
  return p;
}

const MS_PER_DAY = 86_400_000;

/**
 * `count` finished jobs this phone did as the worker, both sides signed on the same terms, the first begun `days` ago:
 * the record the mentor rule counts, written straight into the phone's storage.
 */
export async function seedRecord(p: Phone, count: number, days: number, now: Date): Promise<void> {
  const store = new JobStore(p.storage);
  for (let i = 0; i < count; i++) {
    const id = `eng_${ulid()}` as EngagementId;
    const customer = `usr_${ulid()}` as UserId;
    const agree: Agree = {
      terms: {
        engagement: id,
        offer_id: `off_${ulid()}` as OfferId,
        worker: p.user,
        consumer: customer,
        trade: "cook",
        scope: "Cooking",
        slot: "mornings",
        price_paise: 900_000,
      },
      terms_hash: "a".repeat(64),
      sig: "c2lnbmVk",
    };
    const at = new Date(now.getTime() - (days - i) * MS_PER_DAY).toISOString();
    const job: JobRecord = {
      engagement: {
        id,
        group: id,
        role: "provider",
        counterpart: customer,
        status: "closed",
        brief: { text: "Cooking", topic: "cook", shared: {} },
        created_at: at,
        updated_at: at,
      },
      request: { need: "Cooking", trade: "cook", when: "mornings", area: BENGALURU, details: {}, lang: "en" },
      offers: [],
      offers_made: 0,
      asked: false,
      mine: agree,
      theirs: agree,
    };
    await store.saveJob(job);
  }
}

export const MUKESH: ContactCard = { name: "Mukesh", phone: "+919800000505" };
export const ASHA_N: ContactCard = { name: "Asha", phone: "+919800000606" };
export const LATA: ContactCard = { name: "Lata", phone: "+919800000707" };
export const MUKESH_CARD: ColleagueCard = { name: "Mukesh", trades: ["cook"], languages: ["hi", "kn"] };
export const ASHA_N_CARD: ColleagueCard = { name: "Asha", trades: ["cook"], languages: ["hi"] };
export const LATA_CARD: ColleagueCard = { name: "Lata", trades: ["cook"], languages: ["hi"] };
