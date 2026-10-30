/** Why a mentor step was refused. The screen shows the matching `mentor.*` line. */
export const MentorRefusal = {
  /** Their phone runs a GigSync too old for mentors: `mentor.too_old`. */
  tooOld: "too_old",
  /** This phone's record does not reach the minimum yet: `moving.not_eligible`. */
  notEligible: "not_eligible",
  /** This build has no API to list or match mentors. */
  noServer: "no_server",
  /** More mentors picked than one newcomer may ask at once: `mentor.too_many`. */
  tooMany: "too_many",
  /** That person is blocked on this phone. */
  blocked: "blocked",
  /** No request, offer or introduction like that on this phone, or it has moved on. */
  notFound: "not_found",
  /** No live mentor link with that person on this phone: nothing to write to or renew. */
  notLinked: "not_linked",
  /** Neither a job both sides signed nor a mentor link with that person: they cannot be introduced or asked. */
  notKnown: "not_known",
  /** A mentor link that has run out cannot be renewed or written to. */
  expired: "expired",
  /** The safety words come before any contact: `mentor.safety_title`. */
  safetyFirst: "safety_first",
} as const;
export type MentorRefusal = (typeof MentorRefusal)[keyof typeof MentorRefusal];

/** A mentor action this phone will not take; `reason` says which. */
export class MentorError extends Error {
  constructor(readonly reason: MentorRefusal) {
    super(`mentor refused: ${reason}`);
  }
}
