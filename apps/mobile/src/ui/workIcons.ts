import { Trade } from "@gigsync/protocol";
import type { IconName } from "./Icon.js";

/**
 * The picture on each trade's chip in the card chat (the design's picture chips, W1). A kit icon where the kit draws
 * one; for the three it does not draw yet, a line drawing in the kit's own style (a 24px grid, one stroked path), so
 * every trade has a picture and none borrows another's.
 */
export type WorkPicture = { icon: IconName } | { path: string };

const T = Trade.enum;

export const WORK_PICTURE: Readonly<Record<Trade, WorkPicture>> = {
  /** A lightning bolt. */
  [T.electrician]: { path: "M13 3 5 14h6l-1 7 8-11h-6z" },
  [T.plumber]: { icon: "wrench" },
  [T.maid]: { icon: "broom" },
  /** A mallet: its head and handle. */
  [T.carpenter]: { path: "M9 4h11v5H9zM14.5 9v11.5" },
  /** A snowflake: three strokes through the middle, and the two ends of the upright one. */
  [T.ac_technician]: { path: "M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 5 12 7.5 14.5 5M9.5 19l2.5-2.5 2.5 2.5" },
  [T.painter]: { icon: "brush" },
  [T.cook]: { icon: "pot" },
  [T.driver]: { icon: "car" },
};

/** The picture for a chip's value when it is a trade; none for any other answer. */
export function workPicture(value: string): WorkPicture | undefined {
  const trade = Trade.safeParse(value);
  return trade.success ? WORK_PICTURE[trade.data] : undefined;
}
