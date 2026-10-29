/** Why linking with or writing to a colleague was refused. The screen shows the matching `colleague.*` line. */
export const ColleagueRefusal = {
  /** The scanned text is not a GigSync colleague code: `colleague.bad_code`. */
  badCode: "bad_code",
  /** The code is this phone's own: `colleague.own_code`. */
  ownCode: "own_code",
  /** One of their phones runs a GigSync too old for colleagues: `colleague.too_old`. */
  tooOld: "too_old",
  /** No link with that worker on this phone yet, or it is still waiting for their phone. */
  notLinked: "not_linked",
} as const;
export type ColleagueRefusal = (typeof ColleagueRefusal)[keyof typeof ColleagueRefusal];

/** A colleague action this phone will not take; `reason` says which, for the screen to explain. */
export class ColleagueError extends Error {
  constructor(readonly reason: ColleagueRefusal) {
    super(`colleague refused: ${reason}`);
  }
}

/** Why suggesting a colleague, or asking the one suggested, was refused. */
export const ReferralRefusal = {
  /** Only a request this phone turned down as the worker can be passed on. */
  notDeclined: "not_declined",
  /** Only a linked colleague can be suggested. */
  notLinked: "not_linked",
  /** The household's GigSync cannot receive suggestions yet: `refer.too_old`. */
  tooOld: "too_old",
  /** Nobody was suggested on this job, or its need is gone from this phone. */
  noReferral: "no_referral",
} as const;
export type ReferralRefusal = (typeof ReferralRefusal)[keyof typeof ReferralRefusal];

/** A referral this phone will not send or follow; `reason` says which. */
export class ReferralError extends Error {
  constructor(readonly reason: ReferralRefusal) {
    super(`referral refused: ${reason}`);
  }
}
