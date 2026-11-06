import { type MessageKey, QrError, QrProblem, qrProblemOf } from "@gigsync/core";
import { errorKey } from "../ui/errorKey.js";

/** The line each refused QR step shows. */
const LINE: Readonly<Record<QrProblem, MessageKey>> = {
  [QrProblem.offered_today]: "qr.offered_today",
  [QrProblem.worker_limit]: "qr.worker_limit",
  [QrProblem.household_limit]: "qr.household_limit",
  [QrProblem.no_card]: "qr.need_card",
  [QrProblem.not_household]: "qr.not_household",
  [QrProblem.too_old]: "qr.too_old",
  [QrProblem.no_server]: "qr.no_server",
  [QrProblem.blocked]: "qr.blocked",
  [QrProblem.ended]: "qr.ended",
  [QrProblem.too_many]: "qr.too_many",
  [QrProblem.not_found]: "qr.not_found",
  [QrProblem.no_job_record]: "qr.recommend_no_record",
  [QrProblem.not_listed]: "qr.recommend_not_listed",
};

/** What to tell the owner when a QR step failed: why it was refused, or why the call did not get through. */
export function qrErrorKey(err: unknown): MessageKey {
  const problem = qrProblemOf(err);
  return problem instanceof QrError ? LINE[problem.problem] : errorKey(problem);
}
