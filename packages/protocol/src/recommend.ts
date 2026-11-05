import { z } from "zod";
import { UserId } from "./ids.js";
import { QrCode } from "./qr.js";

/**
 * A household recommends a worker to someone it knows (ADR 0055): its phone gets the worker's live QR code from the
 * server and shares the link through the phone's own apps, so GigSync never learns whom it went to. The worker is told
 * by a `recommended` envelope on the job, with an empty body.
 */

/**
 * The device capability number that understands `recommended`, which is sent only when every device of the worker
 * reports it. Includes PART_PAYMENTS_PROTOCOL (10) and everything before it.
 */
export const RECOMMEND_PROTOCOL = 11;

/** `POST /v1/qr/recommend`: the worker to recommend. */
export const RecommendRequest = z.object({ worker: UserId });
export type RecommendRequest = z.infer<typeof RecommendRequest>;

/** The worker's live code, for the link the household shares. */
export const RecommendLink = z.object({ code: QrCode });
export type RecommendLink = z.infer<typeof RecommendLink>;

/** Why `POST /v1/qr/recommend` refused, as its `{ error }`: the phone tells its owner which. */
export const RecommendRefusal = z.enum([
  /** No job on record between the caller and this worker, or the worker blocked the caller. Told apart by nobody. */
  "no_job_record",
  /** The worker has no card on the board, so there is nothing to pass on. */
  "not_listed",
]);
export type RecommendRefusal = z.infer<typeof RecommendRefusal>;
