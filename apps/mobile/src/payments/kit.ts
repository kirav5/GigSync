import { C } from "../ui/cls.js";

/** The design kit's classes (styles.css) as the money steps use them, named once for the files in this folder. */
export const K = {
  /** A step's one primary action: rust, full width and tall. */
  big: `${C.accent} btn-big wide`,
  /** Small print: who and when, and the notes under the buttons. */
  fine: "fine",
  /** The earth card that says who asks, or says they paid, over the amount. */
  hero: `${C.card} card-earth pay-hero`,
  amount: "money-big",
} as const;
