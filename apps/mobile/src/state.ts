/**
 * The screens of the app. Four bottom tabs per role are the roots (`shell/nav.ts`): Home, Jobs, Money and Me for a
 * worker; Find, Jobs, Pay and Me for a household. Every other screen is opened from inside one of them, and Back
 * steps out the way it came in (`shell/useNav.ts`).
 */
export const Screen = {
  /** A worker's Home tab: what needs them today and the way into Talk. */
  home: "home",
  /** A household's first tab: Find's chat (or its form). */
  find: "find",
  /** Talk, a worker's chats with their agent, opened from Home (or where a worker without a card lands). */
  talk: "talk",
  /** The Jobs tab: Awaiting you, In talks and Agreed, for a worker and a household alike. */
  activity: "activity",
  /** The Money tab (Pay for a household): earnings and the work record for a worker; what a household paid. */
  records: "records",
  /** The Me tab: who the owner is, and the rows to their card, record, About me, Privacy, Settings and the rest. */
  me: "me",
  /** The chats kept on this phone, a worker's Talk chats or a household's Find chats, with New chat. */
  chats: "chats",
  /** What needs the owner now, from the bell on Home, Jobs and Find. */
  alerts: "alerts",
  /** Help: a mentor and where to turn, from Me. */
  help: "help",
  /** The workers a household has had a job signed with, to ask again, from Me. */
  people: "people",
  /** The app's language, from Me. */
  language: "language",
  /** A household's saved addresses (ADR 0045), from Me. */
  addresses: "addresses",
  /** A worker's record as GigSync keeps it, and whether their card shows it, from Me. */
  myRecord: "my_record",
  /** The owner's card at a glance and their QR code. */
  card: "card",
  /** Name and role, the UPI ID (workers), language, and what the agent remembers. */
  about: "about",
  /** Price sharing and mentor links. */
  privacy: "privacy",
  /** Look, voice actions, the on-device model, how the agent bargains, and this phone: Install, moving, Sign out. */
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
