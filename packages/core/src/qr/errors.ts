import { OfferRefusal } from "@gigsync/protocol";
import { HttpError } from "../net/api.js";

/** Why a QR step was refused. The screen shows the matching `qr.*` line. */
export const QrProblem = {
  ...OfferRefusal.enum,
  /** Their phone runs a GigSync too old for offers to work: `qr.too_old`. */
  too_old: "too_old",
  /** This build has no API for personal QR codes. */
  no_server: "no_server",
  /** That person is blocked on this phone. */
  blocked: "blocked",
  /** The QR was replaced or never existed: `qr.ended`. */
  ended: "ended",
  /** Too many QR lookups this hour: `qr.too_many`. */
  too_many: "too_many",
  /** No offer like that on this phone, or it has moved on. */
  not_found: "not_found",
} as const;
export type QrProblem = (typeof QrProblem)[keyof typeof QrProblem];

/** A QR step this phone will not take, or the server refused; `problem` says which. */
export class QrError extends Error {
  constructor(readonly problem: QrProblem) {
    super(`qr refused: ${problem}`);
  }
}

const NOT_FOUND = 404;
const TOO_MANY = 429;

/** The server's answer to a QR call as a QrError when it is one the owner should be told about; else unchanged. */
export function qrProblemOf(err: unknown): unknown {
  if (!(err instanceof HttpError)) return err;
  const refusal = OfferRefusal.safeParse(err.error);
  if (refusal.success) return new QrError(refusal.data);
  if (err.status === NOT_FOUND) return new QrError(QrProblem.ended);
  if (err.status === TOO_MANY) return new QrError(QrProblem.too_many);
  return err;
}
