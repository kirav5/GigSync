import { log, MentorError, MentorRefusal, type MessageKey } from "@gigsync/core";
import { errorKey } from "../../ui/errorKey.js";

const GENERIC: MessageKey = "error.generic";

/** A mentor refusal in the owner's words; the ones these screens cannot reach read as a generic error. */
const MENTOR: Readonly<Record<MentorRefusal, MessageKey>> = {
  [MentorRefusal.tooOld]: "mentor.too_old",
  [MentorRefusal.notEligible]: "moving.not_eligible",
  [MentorRefusal.tooMany]: "mentor.max",
  [MentorRefusal.safetyFirst]: "mentor.safety_title",
  [MentorRefusal.noServer]: GENERIC,
  [MentorRefusal.blocked]: GENERIC,
  [MentorRefusal.notFound]: GENERIC,
  [MentorRefusal.notLinked]: GENERIC,
  [MentorRefusal.notKnown]: "mentor.intro_none",
  [MentorRefusal.expired]: GENERIC,
};

/** What to tell the owner when a mentor step failed. Logs the failure without anyone's words. */
export function mentorProblem(what: string, err: unknown): MessageKey {
  log.warn(what, { error: err instanceof Error ? err.message : String(err) });
  if (err instanceof MentorError) return MENTOR[err.reason];
  return errorKey(err);
}
