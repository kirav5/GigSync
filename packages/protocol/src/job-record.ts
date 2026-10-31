import { z } from "zod";
import { Role } from "./engagement.js";
import { Base64 } from "./envelope.js";
import { AreaKey } from "./estimate.js";
import {
  AcScope,
  CarpenterScope,
  CookScope,
  DriverScope,
  ElectricianScope,
  MaidScope,
  PainterScope,
  PlumberScope,
} from "./estimate-scope.js";
import { EngagementId, PaymentId, UserId } from "./ids.js";
import { TermsHash } from "./job.js";
import { Paise, PaymentMethod } from "./payment.js";
import { Terms, TermWhen, termsFit } from "./terms.js";
import { Trade } from "./trade.js";
import { MAX_STARS, MIN_STARS } from "./worker-record.js";

/**
 * Job records on the server (ADR 0038): structured fields only, never free text, contact details, addresses or UPI
 * ids. Every object here is strict, so a key outside the allowlist is refused rather than quietly dropped: a phone that
 * tried to send words would find out at once. After both sign, each phone submits the job as it agreed it, with its own
 * signature over the terms hash; the server stores the job only when both sides sent the same fields and both
 * signatures verify against their active devices' keys.
 */

/** The notice a person must have accepted before the server keeps job records for them. Bump it with the notice text. */
export const RECORDS_NOTICE_VERSION = "2026-10-31";

/** Domain separation for an `agree` signature: what a phone signs is this prefix and the terms hash. */
export const AGREE_PREFIX = "gigsync/agree/v1:";
export const agreeBytes = (hash: string): Uint8Array => new TextEncoder().encode(`${AGREE_PREFIX}${hash}`);

/** Writes one person may make in an hour: submissions (each one checks a signature) and star replacements. */
export const RECORD_SUBMISSIONS_PER_HOUR = 60;
export const STARS_PER_HOUR = 20;

const T = Trade.enum;
const work = <K extends Trade, S extends z.ZodRawShape>(trade: K, scope: z.ZodObject<S>) =>
  z.strictObject({ trade: z.literal(trade), scope: z.strictObject(scope.shape) });

/** The trade and its scope buckets (ADR 0030's, the only keys and values allowed): counts and yes/no, never words. */
export const JobWork = z.discriminatedUnion("trade", [
  work(T.electrician, ElectricianScope),
  work(T.plumber, PlumberScope),
  work(T.maid, MaidScope),
  work(T.carpenter, CarpenterScope),
  work(T.ac_technician, AcScope),
  work(T.painter, PainterScope),
  work(T.cook, CookScope),
  work(T.driver, DriverScope),
]);
export type JobWork = z.infer<typeof JobWork>;

/** The agreed terms other than price, strict: the day and part of it, who buys materials, coats, hours a day. */
export const JobTermsFields = z.strictObject({ ...Terms.shape, when: z.strictObject(TermWhen.shape).optional() });
export type JobTermsFields = z.infer<typeof JobTermsFields>;

/**
 * `POST /v1/jobs/records`: one side's account of a job both signed. `role` is the sender's (provider = the worker,
 * requester = the household); `sig` is the sender's `agree` signature, Ed25519 over `agreeBytes(terms_hash)`. `area`
 * is the pilot area the job's request named (its slug, never an address), so market prices can be told by area
 * (ADR 0039 §1); both phones derive it from the same request.
 */
export const JobRecordSubmit = z
  .strictObject({
    engagement: EngagementId,
    counterpart: UserId,
    role: Role,
    work: JobWork,
    area: AreaKey.optional(),
    terms: JobTermsFields.default({}),
    price_paise: Paise,
    terms_hash: TermsHash,
    sig: Base64,
  })
  .refine((s) => termsFit(s.work.trade, s.terms), "a term this trade does not negotiate");
export type JobRecordSubmit = z.infer<typeof JobRecordSubmit>;
export type JobRecordSubmitInput = z.input<typeof JobRecordSubmit>;

/**
 * A job as both sides must agree on it, from the job's point of view rather than a sender's: who is the worker and who
 * the household, the work, the terms, the price and the hash both signed. The server compares submissions by the
 * canonical JSON of this and keeps it with each submission.
 */
export const JobRecordFields = z.strictObject({
  engagement: EngagementId,
  worker: UserId,
  household: UserId,
  work: JobWork,
  area: AreaKey.optional(),
  terms: JobTermsFields,
  price_paise: Paise,
  terms_hash: TermsHash,
});
export type JobRecordFields = z.infer<typeof JobRecordFields>;

/**
 * Where a job stands after a submission (ADR 0038 §2):
 * - `pending`: waiting. A household's side alone never makes a job; a worker's side waits until the server has
 *   delivered the household's `agree` for that engagement to her (then it becomes `one_sided` by itself);
 * - `one_sided`: the worker's submission, stored as a job that counts on her record with `attested: false` until the
 *   household's matching submission arrives (a household that declined the notice never sends one). Only once the
 *   household's own signed `agree` went through the mailbox to her, so a worker cannot invent jobs;
 * - `stored`: both sides matched and verified (`attested: true`);
 * - `mismatch`: the two sides sent different fields; set aside and not counted (a one-sided job is withdrawn), and
 *   either side may submit again to correct it.
 */
export const JobSubmitState = z.enum(["pending", "one_sided", "stored", "mismatch"]);
export type JobSubmitState = z.infer<typeof JobSubmitState>;
export const JobSubmitResult = z.object({ state: JobSubmitState });
export type JobSubmitResult = z.infer<typeof JobSubmitResult>;

/** A stored job's status. Every stored job starts `agreed`; either side may mark it done or cancelled, once. */
export const JobRecordStatus = z.enum(["agreed", "done", "cancelled"]);
export type JobRecordStatus = z.infer<typeof JobRecordStatus>;

/** `POST /v1/jobs/records/:engagement/status`. */
export const JobStatusChange = z.strictObject({ status: JobRecordStatus.exclude(["agreed"]) });
export type JobStatusChange = z.infer<typeof JobStatusChange>;

/** A calendar day, "YYYY-MM-DD". */
export const IsoDay = z.iso.date();

/**
 * `POST /v1/jobs/records/:engagement/payments`: amount, day and method. Never a UPI reference or UPI id: the strict
 * object refuses them. From the worker (who received it) it counts at once; from the household (who paid it) it waits
 * until the worker confirms receipt.
 */
export const PaymentReport = z.strictObject({
  payment: PaymentId,
  amount_paise: Paise,
  paid_on: IsoDay,
  method: PaymentMethod,
});
export type PaymentReport = z.infer<typeof PaymentReport>;

/** `PUT /v1/jobs/records/:engagement/stars`: the household's stars for a stored job; a later one replaces it. */
export const StarsReport = z.strictObject({ stars: z.number().int().min(MIN_STARS).max(MAX_STARS) });
export type StarsReport = z.infer<typeof StarsReport>;

/** `PUT /v1/consent`: the records notice version the person accepted. */
export const ConsentAccept = z.strictObject({ notice_version: z.string().min(1).max(32) });
export type ConsentAccept = z.infer<typeof ConsentAccept>;

/** `GET /v1/consent`: what the person accepted, and whether it is the notice shown now. 404 when nothing. */
export const ConsentState = z.object({
  notice_version: z.string(),
  accepted_at: z.iso.datetime({ offset: true }),
  current: z.boolean(),
});
export type ConsentState = z.infer<typeof ConsentState>;

/** Why a job-record write was refused, as its `{ error }`: the phone tells its owner which. */
export const RecordRefusal = z.enum([
  /** No accepted notice, or one older than RECORDS_NOTICE_VERSION (403): ask the owner to read and accept it. */
  "no_consent",
  /** `PUT /v1/consent` named a notice that is not the current one (409). */
  "stale_notice",
  /** The signature does not verify against any of the sender's active devices (400). */
  "bad_signature",
  /** The job is already stored with different fields (409). */
  "record_differs",
  /** Only the household may give stars (403). */
  "households_only",
  /** Only the worker, who received the money, may confirm a payment (403). */
  "workers_only",
  /** The job is cancelled, or already in another final status (409). */
  "wrong_status",
]);
export type RecordRefusal = z.infer<typeof RecordRefusal>;
