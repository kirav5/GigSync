import { z } from "zod";
import { Phone } from "./auth.js";
import { Base64, EnvelopeKind } from "./envelope.js";
import { EngagementId, prefixedId, UserId } from "./ids.js";
import { DEFAULT_LANG, Lang, QuestionKey } from "./lang.js";
import { Paise, PaymentRecord, PaymentRequest } from "./payment.js";

/**
 * What travels inside a job's sealed envelopes, one body per envelope kind. The server never sees any of it: the
 * consumer's need, the offers, the agreed terms and each side's contact card exist only on the two phones.
 */

/** The trades GigSync lists. A worker offers one or more; a consumer asks for exactly one. */
export const Trade = z.enum([
  "electrician",
  "plumber",
  "maid",
  "carpenter",
  "ac_technician",
  "painter",
  "cook",
  "driver",
]);
export type Trade = z.infer<typeof Trade>;

/** An approximate place (a neighbourhood, never a door): what discovery and the request use. */
export const Place = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });
export type Place = z.infer<typeof Place>;

export const OfferId = prefixedId("off");
export type OfferId = z.infer<typeof OfferId>;

/** A detail a worker may ask about and a consumer may already have given, e.g. `problem` or `rooms`. */
export const DetailKey = z.string().regex(/^[a-z][a-z_]{0,31}$/, "detail key");
const shortText = z.string().min(1).max(300);
const SLOT_MAX = 100;
export const SCOPE_MAX = 500;
/** Offers stop after this many rounds per side; then the agents hand the decision back to their owners. */
export const MAX_ROUNDS = 5;
export const MAX_QUESTIONS = 5;

/** `request`: the consumer's need, as their agent may share it. Their budget never leaves the phone. */
export const JobRequest = z.object({
  trade: Trade,
  need: z.string().min(1).max(1000),
  when: z.string().min(1).max(SLOT_MAX),
  area: Place,
  /** Answers the consumer gave up front, so the worker's agent need not ask. */
  details: z.record(DetailKey, shortText).default({}),
  /** The language `need` and any free-text detail are written in, so the worker's phone can translate on receipt. */
  lang: Lang.default(DEFAULT_LANG),
});
export type JobRequest = z.infer<typeof JobRequest>;

/** A question by key only: each phone renders it in its owner's language (`t()` in `@gigsync/core`). */
export const Question = z.object({ key: QuestionKey });
export type Question = z.infer<typeof Question>;

/** `clarify`: what the worker's agent needs to know before it can quote. */
export const Clarify = z.object({ questions: z.array(Question).min(1).max(MAX_QUESTIONS) });
export type Clarify = z.infer<typeof Clarify>;

/** `response`: answers to a `clarify`, by detail key. */
export const Answers = z.object({ answers: z.record(DetailKey, shortText) });
export type Answers = z.infer<typeof Answers>;

/** `quote` (worker) and `counter` (consumer): one offer, numbered per side. */
export const Offer = z.object({
  offer_id: OfferId,
  round: z.number().int().min(1).max(MAX_ROUNDS),
  price_paise: Paise,
  slot: z.string().min(1).max(SLOT_MAX),
  scope: z.string().min(1).max(SCOPE_MAX),
});
export type Offer = z.infer<typeof Offer>;

/** What both sides sign. Canonical JSON of this, hashed, is the `terms_hash`. */
export const JobTerms = z.object({
  engagement: EngagementId,
  offer_id: OfferId,
  worker: UserId,
  consumer: UserId,
  trade: Trade,
  scope: z.string().min(1).max(SCOPE_MAX),
  slot: z.string().min(1).max(SLOT_MAX),
  price_paise: Paise,
});
export type JobTerms = z.infer<typeof JobTerms>;

export const TermsHash = z.string().regex(/^[0-9a-f]{64}$/, "sha-256 hex");

/** `agree`: the sender accepts these exact terms and signs their hash with its device key. */
export const Agree = z.object({ terms: JobTerms, terms_hash: TermsHash, sig: Base64 });
export type Agree = z.infer<typeof Agree>;

/** Who to call and where to come. Sent only once both have signed, and only to the other party's devices. */
export const ContactCard = z.object({
  name: z.string().min(1).max(60),
  phone: Phone,
  address: z.string().min(1).max(300).optional(),
});
export type ContactCard = z.infer<typeof ContactCard>;

/** `contact_release`: tied to the terms both signed, so a card can never arrive for an unsigned job. */
export const ContactRelease = z.object({ terms_hash: TermsHash, contact: ContactCard });
export type ContactRelease = z.infer<typeof ContactRelease>;

export const CancelReason = z.enum([
  /** The worker does not do this trade or area. */
  "no_match",
  /** The agents ran out of rounds without meeting inside both limits. */
  "no_deal",
  /** An owner chose not to sign the deal their agent reached. */
  "declined_by_owner",
  /** The consumer agreed with another worker for the same need. */
  "taken",
  "other",
]);
export type CancelReason = z.infer<typeof CancelReason>;

export const Cancel = z.object({ reason: CancelReason, note: z.string().max(300).optional() });
export type Cancel = z.infer<typeof Cancel>;

/** `update` and `delivery`: a short note from the worker (on my way, done), tagged with the language it is in. */
export const Note = z.object({ text: shortText, lang: Lang.default(DEFAULT_LANG) });
export type Note = z.infer<typeof Note>;

export const MIN_STARS = 1;
export const MAX_STARS = 5;
/** `review`: the consumer's rating once the job is done. */
export const JobReview = z.object({
  stars: z.number().int().min(MIN_STARS).max(MAX_STARS),
  text: z.string().max(500).default(""),
});
export type JobReview = z.infer<typeof JobReview>;

const Empty = z.object({});
const K = EnvelopeKind.enum;

/** The body schema for each envelope kind, used after opening an envelope and before acting on it. */
export const BODY: Readonly<Record<EnvelopeKind, z.ZodType>> = {
  [K.request]: JobRequest,
  [K.clarify]: Clarify,
  [K.response]: Answers,
  [K.quote]: Offer,
  [K.counter]: Offer,
  [K.agree]: Agree,
  [K.contact_release]: ContactRelease,
  [K.update]: Note,
  [K.delivery]: Note,
  [K.review]: JobReview,
  [K.cancel]: Cancel,
  [K.receipt]: Empty,
  [K.key_change]: Empty,
  [K.payment_request]: PaymentRequest,
  [K.payment_record]: PaymentRecord,
};
