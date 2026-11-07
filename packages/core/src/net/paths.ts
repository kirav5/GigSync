/** The routes of workers/api this client calls. */
export const ApiPath = {
  otpRequest: "/v1/auth/otp/request",
  otpVerify: "/v1/auth/otp/verify",
  signOut: "/v1/me/signout",
  directory: "/v1/directory/",
  mailbox: "/v1/mailbox/",
  inbox: "/v1/inbox",
  ack: "/v1/inbox/ack",
  /** Which of my devices answers an engagement (ADR 0045): `POST /v1/inbox/claims`. */
  claims: "/v1/inbox/claims",
  boardProfile: "/v1/board/profile",
  boardWorkers: "/v1/board/workers",
  /** The board's skills outside the trades (ADR 0047), matched on the phone: `GET /v1/board/skills`. */
  boardSkills: "/v1/board/skills",
  /** What workers near a place list for a skill (ADR 0057): `GET /v1/board/rates`. */
  boardRates: "/v1/board/rates",
  findCount: "/v1/find/count",
  mentorMe: "/v1/mentors/me",
  mentorMatch: "/v1/mentors/match",
  mentorReport: "/v1/mentors/report",
  mentorBlock: "/v1/mentors/block",
  /** A city's guide for the landing journey: `GET /v1/content/:city`. */
  content: "/v1/content/",
  /** This device now speaks a newer protocol: `PUT /v1/devices/me/protocol`. */
  deviceProtocol: "/v1/devices/me/protocol",
  /** Where this device's browser takes pushes: `PUT` keeps it, `DELETE` turns alerts off. */
  devicePush: "/v1/devices/me/push",
  /** The API's public VAPID key to subscribe with: `GET /v1/devices/push-key`. */
  pushKey: "/v1/devices/push-key",
  /** The usual range for a job (ADR 0030): `POST /v1/estimates`. */
  estimates: "/v1/estimates",
  /** ADR 0045: a coarse point, or typed words, to places (locality, city, PIN). */
  geoReverse: "/v1/geo/reverse",
  geoSearch: "/v1/geo/search",
  /** One agreed price shared anonymously: `POST /v1/estimates/prices`. */
  /** The caller's personal QR (ADR 0034): `PUT` gets or makes it, `/replace` makes a new one. */
  qrMe: "/v1/qr/me",
  qrReplace: "/v1/qr/me/replace",
  qrRecommend: "/v1/qr/recommend",
  /** `GET /v1/qr/:code` looks a code up; `POST /v1/qr/:code/offer` takes an offer to work through it. */
  qr: "/v1/qr/",
  qrOffer: "/offer",
} as const;
