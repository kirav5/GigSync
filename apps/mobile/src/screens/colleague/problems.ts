import { ColleagueError, ColleagueRefusal, log, type MessageKey, ReferralError, ReferralRefusal } from "@gigsync/core";
import { errorKey } from "../../ui/errorKey.js";

const GENERIC: MessageKey = "error.generic";

/** Writing to someone not linked (or not yet) cannot happen from these screens, which open only linked threads. */
const COLLEAGUE: Readonly<Record<ColleagueRefusal, MessageKey>> = {
  [ColleagueRefusal.badCode]: "colleague.bad_code",
  [ColleagueRefusal.ownCode]: "colleague.own_code",
  [ColleagueRefusal.tooOld]: "colleague.too_old",
  [ColleagueRefusal.notLinked]: GENERIC,
};

/** Only an old household phone is the owner's to know about; the rest cannot happen from these screens. */
const REFERRAL: Readonly<Record<ReferralRefusal, MessageKey>> = {
  [ReferralRefusal.tooOld]: "refer.too_old",
  [ReferralRefusal.notDeclined]: GENERIC,
  [ReferralRefusal.notLinked]: GENERIC,
  [ReferralRefusal.noReferral]: GENERIC,
};

/**
 * What to tell the owner when a colleague or referral step failed: the refusal in its own words (its `{name}` is the
 * colleague's), no answer from the server, or a generic error. Logs the failure without anyone's words.
 */
export function colleagueProblem(what: string, err: unknown): MessageKey {
  log.warn(what, { error: err instanceof Error ? err.message : String(err) });
  if (err instanceof ColleagueError) return COLLEAGUE[err.reason];
  if (err instanceof ReferralError) return REFERRAL[err.reason];
  return errorKey(err);
}
