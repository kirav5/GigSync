/** The screens of the app: each role's tabs, and My card under Profile. */
export const Screen = {
  find: "find",
  requests: "requests",
  today: "today",
  talk: "talk",
  passbook: "passbook",
  profile: "profile",
  card: "card",
  /** Colleagues linked in person, under Profile. */
  colleagues: "colleagues",
} as const;
export type Screen = (typeof Screen)[keyof typeof Screen];

/** The worker's card: none yet, made but off the board, or on the board. */
export const CardState = { none: "none", off: "off", on: "on" } as const;
export type CardState = (typeof CardState)[keyof typeof CardState];
