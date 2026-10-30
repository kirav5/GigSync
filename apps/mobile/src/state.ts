/** The screens of the app: each role's tabs, and My card under Profile. */
export const Screen = {
  find: "find",
  requests: "requests",
  today: "today",
  talk: "talk",
  passbook: "passbook",
  profile: "profile",
  card: "card",
  /** One mentor link: its notes, renew, block and introductions, opened from Profile. */
  link: "link",
  /** Moving to a new city: the checklist of the landing journey and its city guide, opened from a move in Talk. */
  landing: "landing",
  /** Find a mentor in a new city: the fallback screen, with introductions, opened from Talk and the landing journey. */
  findMentor: "find_mentor",
  /** The owner's own QR code, to show, download, share or replace, and to scan someone else's; under Profile. */
  myQr: "my_qr",
  /** Whoever a scanned QR or an opened QR link finds. */
  person: "person",
} as const;
export type Screen = (typeof Screen)[keyof typeof Screen];

/** The worker's card: none yet, made but off the board, or on the board. */
export const CardState = { none: "none", off: "off", on: "on" } as const;
export type CardState = (typeof CardState)[keyof typeof CardState];
