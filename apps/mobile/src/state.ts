/**
 * The screens of the app. Three bottom tabs per role are the roots (`shell/nav.ts`): Home, Jobs and Money, Home being
 * the owner's chat: Talk for a worker, Find's chat for a household. The owner's own pages open from the profile sheet
 * (the round button with their initial, top right; "from Me" below means from there). Every other screen is opened from inside another, and Back steps out
 * the way it came in (`shell/useNav.ts`).
 */
export const Screen = {
  /** A household's Home tab: Find's chat (or its form). */
  find: "find",
  /** A worker's Home tab: Talk, their chats with their agent. */
  talk: "talk",
  /** The Jobs tab: Awaiting you, In talks and Agreed, for a worker and a household alike. */
  activity: "activity",
  /** The Money tab: earnings and the work record for a worker; what a household paid. */
  records: "records",
  /** The chats kept on this phone, a worker's Talk chats or a household's Find chats, with New chat. */
  chats: "chats",
  /** What happened and what needs the owner now, from the profile sheet's Alerts row. */
  alerts: "alerts",
  /** Get verified: the Aadhaar QR check on this phone, from the profile sheet. */
  verify: "verify",
  /** Help: a mentor and where to turn, from Me. */
  help: "help",
  /** The workers a household has had a job signed with, to ask again, from Me. */
  people: "people",
  /** The app's language, from Me. */
  language: "language",
  /** A household's saved addresses (ADR 0045), from Me. */
  addresses: "addresses",
  /** A worker's work area and how far they go, on the map, from Me and About me. */
  workArea: "work_area",
  /** A worker's record as GigSync keeps it, and whether their card shows it, from Me. */
  myRecord: "my_record",
  /** The owner's card at a glance and their QR code. */
  card: "card",
  /** Name and role, the UPI ID (workers), language, and what the agent remembers. */
  about: "about",
  /** Price sharing and mentor links. */
  privacy: "privacy",
  /** Look, voice actions, how the agent bargains, and this phone: Install, moving, Sign out. */
  settings: "settings",
  /** The worker's card as a form, to review and change; opened from My card. */
  cardEdit: "card_edit",
  /** One mentor link: its notes, renew, block and introductions, opened from Privacy. */
  link: "link",
  /** Moving to a new city: the checklist of the landing journey and its city guide, from a move in Talk or from Me. */
  landing: "landing",
  /** Find a mentor in a new city: the fallback screen, with introductions, opened from Talk and the landing journey. */
  findMentor: "find_mentor",
  /** Whoever a scanned QR or an opened QR link finds. */
  person: "person",
  /** The steps to put the web app on the home screen, from Settings where the browser has no prompt of its own. */
  install: "install",
  /** The old phone's side of moving to a new one: its move QR, from Settings (ADR 0037). */
  moveOut: "move_out",
  /** The new phone's side: scan the old phone's code, from Settings and once after sign-in on an empty phone. */
  moveIn: "move_in",
  /** The Terms and Privacy Notice (a placeholder until they are written), from Settings (ADR 0039 §4). */
  terms: "terms",
} as const;
export type Screen = (typeof Screen)[keyof typeof Screen];

/** The worker's card: none yet, made but off the board, or on the board. */
export const CardState = { none: "none", off: "off", on: "on" } as const;
export type CardState = (typeof CardState)[keyof typeof CardState];
