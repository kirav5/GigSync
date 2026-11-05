import { z } from "zod";
import { Phone } from "./auth.js";
import { ColleagueLink, ColleagueNote, Referral } from "./colleague.js";
import { Base64, EnvelopeKind } from "./envelope.js";
import { EngagementId, prefixedId, UserId } from "./ids.js";
import { DEFAULT_LANG, Lang, QuestionKey } from "./lang.js";
import { Introduce, LandingRequest, MentorAccept, MentorOffer } from "./mentor-envelopes.js";
import { Paise, PaymentRecord, PaymentRequest } from "./payment.js";
import { LOCALITY_MAX, Place } from "./place.js";
import { JobProblem } from "./problem.js";
import { WorkOffer } from "./qr.js";
import { Skill } from "./skill.js";
import { Terms, termsFit } from "./terms.js";
import { isTrade, JobTrade, Trade } from "./trade.js";
import { MAX_STARS, MIN_STARS } from "./worker-record.js";

export { isTrade, JobTrade, Place, Trade };

/**
 * What travels inside a job's sealed envelopes, one body per envelope kind. The server never sees any of it: the
 * consumer's need, the offers, the agreed terms and each side's contact card exist only on the two phones.
 */

export const OfferId = prefixedId("off");
export type OfferId = z.infer<typeof OfferId>;

/** A detail a worker may ask about and a consumer may already have given, e.g. `problem` or `rooms`. */
export const DetailKey = z.string().regex(/^[a-z][a-z_]{0,31}$/, "detail key");
const shortText = z.string().min(1).max(300);
const SLOT_MAX = 100;
export const SCOPE_MAX = 500;
/**
 * Offers a side may make in all (ADR 0053 §4): its agent's `AGENT_OFFERS`, then two of its owner's own. A phone below
 * `OWNER_OFFERS_PROTOCOL` refuses an offer past `ROUNDS_BEFORE_OWNERS`, so a side sends more only to phones above it.
 */
export const MAX_ROUNDS = 7;
/** The offers a side may make to a phone below `OWNER_OFFERS_PROTOCOL`, which refuses any past this. */
export const ROUNDS_BEFORE_OWNERS = 5;
/**
 * The device capability number that takes offers up to `MAX_ROUNDS` a side. Includes PROBLEM_PROTOCOL (7) and
 * everything before it.
 */
export const OWNER_OFFERS_PROTOCOL = 8;
export const MAX_QUESTIONS = 5;

/** `request`: the consumer's need, as their agent may share it. Their budget never leaves the phone. */
export const JobRequest = z
  .object({
    /** A trade, or `other` with the `skill` the household asked for, as a worker's card lists it (ADR 0047). */
    trade: JobTrade,
    skill: Skill.optional(),
    need: z.string().min(1).max(1000),
    when: z.string().min(1).max(SLOT_MAX),
    area: Place,
    /** ADR 0045: the locality the area is in, as the household's phone named it ("Banashankari"); never the address. */
    locality: z.string().min(1).max(LOCALITY_MAX).optional(),
    /** Answers the consumer gave up front, so the worker's agent need not ask. */
    details: z.record(DetailKey, shortText).default({}),
    /** The language `need` and any free-text detail are written in, so the worker's phone can translate on receipt. */
    lang: Lang.default(DEFAULT_LANG),
    /** The terms the household asks for, from its own words and chips; only to phones at `TERMS_PROTOCOL`. */
    terms: Terms.optional(),
  })
  .refine((r) => isTrade(r.trade) === (r.skill === undefined), "a skill exactly when the work is other");
export type JobRequest = z.infer<typeof JobRequest>;

/** The device capability number that understands questions a model wrote (`ModelQuestion`); older phones stall on them. */
export const FREE_QUESTIONS_PROTOCOL = 3;
export const ASK_TEXT_MIN = 3;
export const ASK_TEXT_MAX = 120;

/** How a model-written question is answered: two buttons, a number, or a few words. */
export const AskKind = z.enum(["yes_no", "number", "text"]);
export type AskKind = z.infer<typeof AskKind>;

/** Who wrote a question's words. Only the worker's agent's model, today; standard questions have no author. */
export const AskedBy = z.enum(["model"]);
export type AskedBy = z.infer<typeof AskedBy>;

/** A standard question, by key only: each phone renders it in its owner's language (`t()` in `@gigsync/core`). */
export const StandardQuestion = z.object({ key: QuestionKey });
export type StandardQuestion = z.infer<typeof StandardQuestion>;

/**
 * A question the worker's agent's model wrote, already through the worker phone's guards; the household's phone
 * translates `text` from `lang`. Its key is never a standard one, so a free-text answer can never land under a key
 * the price rules read.
 */
export const ModelQuestion = z.object({
  key: DetailKey.refine((k) => !QuestionKey.safeParse(k).success, "not a standard key"),
  text: z.string().min(ASK_TEXT_MIN).max(ASK_TEXT_MAX),
  lang: Lang,
  kind: AskKind,
  by: AskedBy,
});
export type ModelQuestion = z.infer<typeof ModelQuestion>;

/** Model questions first: a standard question's schema would quietly strip a model question's words. */
export const Question = z.union([ModelQuestion, StandardQuestion]);
export type Question = z.infer<typeof Question>;

export const isModelQuestion = (q: Question): q is ModelQuestion => "by" in q;

/** `clarify`: what the worker's agent needs to know before it can quote. One question per key. */
export const Clarify = z.object({
  questions: z
    .array(Question)
    .min(1)
    .max(MAX_QUESTIONS)
    .refine((qs) => new Set(qs.map((q) => q.key)).size === qs.length, "one question per key"),
});
export type Clarify = z.infer<typeof Clarify>;

/** The answer the household's app sends for a question its owner chose to skip; each phone shows it in its language. */
export const SKIPPED = "skipped";

/** `response`: answers to a `clarify`, by detail key. */
export const Answers = z.object({ answers: z.record(DetailKey, shortText) });
export type Answers = z.infer<typeof Answers>;

/**
 * The household's setting for answers its agent knows from past jobs: ask the owner first (the default), or answer
 * and say so. Kept in the phone's settings only, never sent.
 */
export const AnswerFromMemory = z.enum(["ask", "auto"]);
export type AnswerFromMemory = z.infer<typeof AnswerFromMemory>;

/** `quote` (worker) and `counter` (consumer): one offer, numbered per side. */
export const Offer = z.object({
  offer_id: OfferId,
  round: z.number().int().min(1).max(MAX_ROUNDS),
  price_paise: Paise,
  slot: z.string().min(1).max(SLOT_MAX),
  scope: z.string().min(1).max(SCOPE_MAX),
  /** The terms this side proposes with the price; only between phones at `TERMS_PROTOCOL`. */
  terms: Terms.optional(),
  /** The owner made this offer themselves, not their agent (ADR 0053 §6). Never part of the signed terms. */
  owner: z.literal(true).optional(),
});
export type Offer = z.infer<typeof Offer>;

/**
 * What both sides sign. Canonical JSON of this, hashed, is the `terms_hash`. Without `terms` the hash is the same as
 * before terms existed (canonical JSON leaves out what is undefined), so deals between older phones still match.
 */
export const JobTerms = z
  .object({
    engagement: EngagementId,
    offer_id: OfferId,
    worker: UserId,
    consumer: UserId,
    trade: JobTrade,
    scope: z.string().min(1).max(SCOPE_MAX),
    slot: z.string().min(1).max(SLOT_MAX),
    price_paise: Paise,
    /** The terms other than price the two agents agreed; only those the trade negotiates. */
    terms: Terms.optional(),
  })
  .refine((t) => t.terms === undefined || termsFit(t.trade, t.terms), "a term this trade does not negotiate");
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
  /** ADR 0050 §7: the address's exact point, for the worker's map; sealed to their devices like the address. */
  point: Place.optional(),
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

/**
 * Why a job was stopped after the work started (ADR 0054). Its own field, not a CancelReason: an older phone refuses a
 * reason it does not know and would never see the job end, but drops this field and still cancels.
 */
export const StopReason = z.enum(["cannot_finish", "asked_to_stop", "not_safe", "other"]);
export type StopReason = z.infer<typeof StopReason>;

export const Cancel = z.object({
  reason: CancelReason,
  note: z.string().max(300).optional(),
  stop: StopReason.optional(),
});
export type Cancel = z.infer<typeof Cancel>;

/**
 * The common progress notes, as codes: each phone renders them in its owner's language, so they never need machine
 * translation (multilanguage plan §3.2). Anything else travels as free text and is translated on the reader's phone.
 */
export const UpdateCode = z.enum(["on_my_way", "started", "done", "delayed"]);
export type UpdateCode = z.infer<typeof UpdateCode>;

/**
 * `update` and `delivery`: a short note from the worker, tagged with the language it is in. With a `code`, `text` is
 * the sender's own wording of it, kept for the record; the reader's phone shows the code in its owner's language.
 */
export const Note = z.object({ text: shortText, lang: Lang.default(DEFAULT_LANG), code: UpdateCode.optional() });
export type Note = z.infer<typeof Note>;

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
  [K.colleague]: ColleagueLink,
  [K.colleague_note]: ColleagueNote,
  [K.referral]: Referral,
  [K.introduce]: Introduce,
  [K.landing_request]: LandingRequest,
  [K.mentor_offer]: MentorOffer,
  [K.mentor_accept]: MentorAccept,
  [K.work_offer]: WorkOffer,
  [K.problem]: JobProblem,
  [K.recommended]: Empty,
};
