/** How Talk treats the card interview when it next opens. */
export const OpenInterview = {
  /** Leaves it: the open chat, or the greeting. */
  no: "no",
  /**
   * Opens only one already under way, in its own chat: a worker with no card coming back to the app. One who tapped
   * Later on the work step has none, so they land on the greeting, with the card a tap away.
   */
  carryOn: "carry_on",
  /** Opens it: carried on where it was, or begun (every way into making or changing the card). */
  yes: "yes",
} as const;
export type OpenInterview = (typeof OpenInterview)[keyof typeof OpenInterview];
