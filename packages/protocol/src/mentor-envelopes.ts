import { z } from "zod";
import { ColleagueCard } from "./colleague.js";
import { City } from "./content.js";
import { UserId } from "./ids.js";
import { Lang } from "./lang.js";
import { MentorCard } from "./mentor.js";
import { Trade } from "./trade.js";

/**
 * Bodies of the mentor envelopes. Like the colleague kinds they sit outside any job: their `engagement` is the
 * channel the mentor link will use once it opens. The introducer picks a fresh channel for an `introduce` and sends
 * it to both people; a newcomer picks a fresh channel for each `landing_request`. Every reply travels on the same
 * channel. Senders check that every device of each recipient reports `MENTOR_PROTOCOL` before sending any of them.
 */

const MAX_NAME = 80;
const MAX_AREA = 60;
const MAX_NOTE = 300;
const MAX_LANGUAGES = 5;
const note = z.string().min(1).max(MAX_NOTE);

/** A colleague link is either between two people who met (`colleague`) or a mentor link, which expires. */
export const LinkKind = z.enum(["colleague", "mentor"]);
export type LinkKind = z.infer<typeof LinkKind>;

/**
 * The fields a stored colleague link carries for mentor links. `kind` defaults to `colleague`, so a link stored
 * before mentors existed still parses; `expires_at` is set on mentor links only (opened + `MENTOR_LINK_TTL_MS`).
 */
export const LinkTerms = z.object({
  kind: LinkKind.default(LinkKind.enum.colleague),
  expires_at: z.iso.datetime({ offset: true }).optional(),
});
export type LinkTerms = z.infer<typeof LinkTerms>;

/** Who is new to the city in an introduction or a landing request. */
export const MentorRole = z.enum(["newcomer", "mentor"]);
export type MentorRole = z.infer<typeof MentorRole>;

/** `introduce`: a colleague → each of two of their own linked colleagues, naming the other and who introduced them. */
export const Introduce = z.object({
  /** The other person this envelope introduces. */
  other: UserId,
  card: ColleagueCard,
  city: City,
  /** What the other person is in this introduction; the recipient is the other role. */
  other_role: MentorRole,
  by: z.object({ user: UserId, name: z.string().min(1).max(MAX_NAME) }),
  note: note.optional(),
});
export type Introduce = z.infer<typeof Introduce>;

/** `landing_request`: a newcomer → a mentor they picked from the match, asking for help with the move. */
export const LandingRequest = z.object({
  card: ColleagueCard,
  city: City,
  trade: Trade,
  languages: z.array(Lang).min(1).max(MAX_LANGUAGES),
  /** The Monday of the week they expect to arrive. */
  arrival_week: z.iso.date(),
  /** A neighbourhood they expect to be near, if they know one. */
  area: z.string().min(1).max(MAX_AREA).optional(),
  note: note.optional(),
});
export type LandingRequest = z.infer<typeof LandingRequest>;

/** How someone answers an offer or an introduction. `withdraw`: the newcomer closes it because another link opened. */
export const MentorReply = z.enum(["accept", "decline", "withdraw"]);
export type MentorReply = z.infer<typeof MentorReply>;
const R = MentorReply.enum;

/** `mentor_offer`: a mentor → the newcomer, answering a landing request. An acceptance carries the mentor's card. */
export const MentorOffer = z
  .object({ reply: MentorReply, card: MentorCard.optional(), note: note.optional() })
  .refine((o) => o.reply !== R.accept || o.card !== undefined, "accept needs a card")
  .refine((o) => o.reply !== R.withdraw, "a mentor declines, never withdraws");
export type MentorOffer = z.infer<typeof MentorOffer>;

/**
 * `mentor_accept`: the newcomer → the mentor, confirming an offer (`accept`, which opens the mentor link) or closing
 * it politely (`withdraw`). In an introduction each of the two sends one to the other; the link opens on a phone
 * once it has sent and received `accept` on that channel.
 */
export const MentorAccept = z.object({ reply: MentorReply });
export type MentorAccept = z.infer<typeof MentorAccept>;
