import { z } from "zod";
import { ColleagueCard } from "./colleague.js";
import { City } from "./content.js";
import { UserId } from "./ids.js";
import { Lang } from "./lang.js";
import { Trade } from "./trade.js";

/**
 * Mentors for someone new to a city (agent-flows §2, without ADR 0017's union gate). Two ways in: an introduction
 * through a linked colleague, or a mentor listing the newcomer browses and picks from. The server only matches by
 * fixed rules; it never chooses a mentor. Either way the two end up with a mentor link: a colleague link with
 * `kind: "mentor"` that expires.
 */

/** The device capability number that understands `introduce`, `landing_request`, `mentor_offer`, `mentor_accept`. */
export const MENTOR_PROTOCOL = 4;
/** A worker may list as a mentor once their own record shows this many months since their first both-signed job... */
export const MENTOR_MIN_MONTHS = 6;
/** ...and this many both-signed jobs. Both are the mentor's own count, and the app says so. */
export const MENTOR_MIN_JOBS = 20;
/** How many newcomers a mentor takes at a time unless they choose otherwise. */
export const DEFAULT_MENTOR_SLOTS = 2;
export const MAX_MENTOR_SLOTS = 10;
/** `POST /v1/mentors/match` returns at most this many mentors. */
export const MATCH_LIMIT = 10;
/** A mentor reported by this many different people is left out of matching until someone reviews the reports. */
export const REPORT_SUSPEND = 3;
/** A newcomer sends a landing request to at most this many mentors at once. */
export const MAX_LANDING_REQUESTS = 3;
/** A mentor link lasts this long from when it opens, renewable by either side (thirty days). */
export const MENTOR_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_ITEMS = 5;
const MAX_MONTHS = 600;
const MAX_JOBS = 100_000;
const MAX_NAME = 40;
const MAX_AREA = 60;
const MAX_VOUCHER = 80;

const distinct = <T>(items: T[]) => new Set(items).size === items.length;
const trades = z.array(Trade).min(1).max(MAX_ITEMS).refine(distinct, "no repeated trades");
const languages = z.array(Lang).min(1).max(MAX_ITEMS).refine(distinct, "no repeated languages");
/** A neighbourhood name people recognise, e.g. "Indiranagar": about a kilometre, never an address. */
const area = z.string().min(1).max(MAX_AREA);
/** The union or NGO that vouches for a mentor; set only through the admin route. */
const vouchedBy = z.string().min(1).max(MAX_VOUCHER).nullable();
const firstName = z.string().min(1).max(MAX_NAME);

/** `PUT /v1/mentors/me`: the caller's mentor listing. `woman` is self-declared and only ever used as a filter. */
export const MentorListing = z.object({
  first_name: firstName,
  city: City,
  area,
  trades,
  languages,
  months: z.number().int().min(MENTOR_MIN_MONTHS).max(MAX_MONTHS),
  jobs: z.number().int().min(MENTOR_MIN_JOBS).max(MAX_JOBS),
  /** How many more newcomers they will take now; 0 keeps the listing but leaves them out of matching. */
  open_slots: z.number().int().min(0).max(MAX_MENTOR_SLOTS).default(DEFAULT_MENTOR_SLOTS),
  woman: z.boolean(),
  /** A woman mentor who helps only women newcomers. Ignored unless `woman` is set. */
  women_only_newcomers: z.boolean().default(false),
  /** false pauses the listing without deleting it. */
  active: z.boolean().default(true),
});
export type MentorListing = z.infer<typeof MentorListing>;
export type MentorListingInput = z.input<typeof MentorListing>;

/** What a newcomer sees of a mentor. Never a phone number, contacts, or the woman flag. */
export const MentorProfile = z.object({
  user: UserId,
  first_name: firstName,
  city: City,
  area,
  trades,
  languages,
  months: z.number().int().nonnegative(),
  jobs: z.number().int().nonnegative(),
  vouched_by: vouchedBy,
});
export type MentorProfile = z.infer<typeof MentorProfile>;

/** `PUT` and `GET /v1/mentors/me`: the caller's own listing as stored, with any vouched badge. */
export const MyMentorListing = z.object({ listing: MentorListing.extend({ vouched_by: vouchedBy }) });
export type MyMentorListing = z.infer<typeof MyMentorListing>;

/** `POST /v1/mentors/match`. `woman` is what the newcomer said about herself; the server does not keep it. */
export const MatchRequest = z.object({
  city: City,
  trade: Trade,
  lang: Lang,
  /** Only mentors who said they are women. On by default in the app for a newcomer who said she is a woman. */
  women_only: z.boolean().default(false),
  /** Lets listings that take only women newcomers show up. */
  woman: z.boolean().default(false),
});
export type MatchRequest = z.infer<typeof MatchRequest>;
export type MatchRequestInput = z.input<typeof MatchRequest>;

/** Most jobs first. Empty means "No mentor yet": the app offers introductions and the guide's helplines. */
export const MatchResponse = z.object({ mentors: z.array(MentorProfile).max(MATCH_LIMIT) });
export type MatchResponse = z.infer<typeof MatchResponse>;

/** Why someone is reported. A fixed list, so no private text reaches the server. */
export const ReportReason = z.enum(["asked_money", "asked_documents", "unsafe", "rude", "other"]);
export type ReportReason = z.infer<typeof ReportReason>;

/** `POST /v1/mentors/report`: one report per reporter and person; a second one replaces the reason. */
export const MentorReport = z.object({ user: UserId, reason: ReportReason });
export type MentorReport = z.infer<typeof MentorReport>;

/** `POST /v1/mentors/block`: never match these two again, either way round. */
export const MentorBlock = z.object({ user: UserId });
export type MentorBlock = z.infer<typeof MentorBlock>;

/** `POST /v1/mentors/vouch` (admin only): set or clear (`null`) the vouched badge on a listing. */
export const MentorVouch = z.object({ user: UserId, vouched_by: vouchedBy });
export type MentorVouch = z.infer<typeof MentorVouch>;

/** A mentor as their offer and their link show them: a colleague card plus their record and badge. */
export const MentorCard = ColleagueCard.extend({
  months: z.number().int().nonnegative().max(MAX_MONTHS),
  jobs: z.number().int().nonnegative().max(MAX_JOBS),
  vouched_by: vouchedBy.default(null),
});
export type MentorCard = z.infer<typeof MentorCard>;
