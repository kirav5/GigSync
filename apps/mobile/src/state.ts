/**
 * The screens of the app. The chat is home: Talk for a worker, Find's chat for a household. The menu opens the rest;
 * a few are opened from inside one of those (see `shell/nav.ts`).
 */
export const Screen = {
  /** A household's home: Find's chat (or its form). */
  find: "find",
  /** A worker's home: Talk, their chats with their agent. */
  talk: "talk",
  /** Today's jobs and decisions for a worker; My jobs for a household. */
  activity: "activity",
  /** Passbook and the work record for a worker; what they paid for a household. */
  receipts: "receipts",
  /** The owner's card at a glance and their QR code. */
  card: "card",
  /** Name and role, the UPI ID (workers), language, and what the agent remembers. */
  about: "about",
  /** Price sharing and mentor links. */
  privacy: "privacy",
  /** Look, voice actions, the on-device model, how the agent bargains, and a row to Install. */
  settings: "settings",
  /** The worker's card as a form, to review and change; opened from My card. */
  cardEdit: "card_edit",
  /** One mentor link: its notes, renew, block and introductions, opened from Privacy. */
  link: "link",
  /** Moving to a new city: the checklist of the landing journey and its city guide, opened from a move in Talk. */
  landing: "landing",
  /** Find a mentor in a new city: the fallback screen, with introductions, opened from Talk and the landing journey. */
  findMentor: "find_mentor",
  /** Whoever a scanned QR or an opened QR link finds. */
  person: "person",
  /** The steps to put the web app on the home screen, from the menu's Install app or Settings. */
  install: "install",
  /** The old phone's side of moving to a new one: its move QR, from Settings (ADR 0037). */
  moveOut: "move_out",
  /** The new phone's side: scan the old phone's code, from Settings and once after sign-in on an empty phone. */
  moveIn: "move_in",
} as const;
export type Screen = (typeof Screen)[keyof typeof Screen];

/** The worker's card: none yet, made but off the board, or on the board. */
export const CardState = { none: "none", off: "off", on: "on" } as const;
export type CardState = (typeof CardState)[keyof typeof CardState];
