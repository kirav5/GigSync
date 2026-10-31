import { DriverKind, DriverName, driverSpec, Trade } from "@gigsync/protocol";
import type { Embedder } from "../ports.js";
import { type Labelled, MeaningIndex } from "../router/meaning.js";

/**
 * What a repair is for, by meaning (ADR 0042): when the problem words miss ("one of the leg is broken" names no door,
 * assembly or repair), the phone's embedding model places the sentence next to the sayings below and the closest
 * kind's label wins, within the trade. English sayings for now, like the trades'. "Something else" has no sayings: it
 * is what a sentence unlike all of these falls back to by not being read at all.
 */

const T = Trade.enum;
const SEPARATOR = "/";

/** How a household describes each kind of job, per repair trade, as said. */
const PROBLEM_SAYINGS: Readonly<Partial<Record<Trade, Readonly<Record<string, readonly string[]>>>>> = {
  [T.electrician]: {
    fan: ["fan not working", "ceiling fan is slow", "fan makes noise", "install a new fan", "fan regulator broken"],
    switch: [
      "switch not working",
      "switch board sparking",
      "socket is dead",
      "plug point loose",
      "switch gives a shock",
    ],
    light: [
      "light not turning on",
      "tube light flickering",
      "bulb holder broken",
      "fit a new light",
      "lights keep going off",
    ],
    wiring: ["wiring problem", "short circuit", "power keeps tripping", "new wiring for a room", "burnt wire smell"],
  },
  [T.plumber]: {
    leak: [
      "water leaking",
      "pipe is leaking",
      "water dripping from the ceiling",
      "leak under the sink",
      "wall is damp from a pipe",
    ],
    tap: ["tap is broken", "tap keeps running", "replace the tap", "no water from the tap", "mixer tap loose"],
    blockage: ["drain blocked", "sink is clogged", "water not draining", "bathroom drain choked", "pipe is blocked"],
    toilet: [
      "toilet flush not working",
      "commode leaking",
      "flush tank broken",
      "toilet seat loose",
      "western toilet repair",
    ],
  },
  [T.carpenter]: {
    door: ["door not closing", "door hinge broken", "fix the door lock", "door is stuck", "new door frame"],
    repair: [
      "table leg is broken",
      "chair is wobbly",
      "fix a broken bed",
      "repair the wooden table",
      "drawer not sliding",
      "cupboard door came off",
    ],
    assembly: [
      "assemble a new bed",
      "put together a wardrobe",
      "assemble furniture",
      "fit a new shelf",
      "install a cupboard",
    ],
  },
  [T.ac_technician]: {
    service: ["ac service", "clean the ac", "ac servicing before summer", "annual ac maintenance"],
    gas_refill: ["ac not cooling", "ac needs gas", "gas refill for the ac", "cooling is weak"],
    install: ["install a new ac", "fit the ac in the bedroom", "shift the ac to another room", "ac installation"],
    repair: [
      "ac is leaking water",
      "ac making noise",
      "ac not switching on",
      "ac remote not working",
      "ac stopped working",
    ],
  },
};

/**
 * A job's words must sound at least this much like a kind's saying; below it, the chips ask. Set from probe sentences:
 * small talk scored up to 0.838 against these sayings within a trade, real repair sentences from 0.867 up.
 */
export const PROBLEM_MIN_SIMILARITY = 0.85;

const label = (trade: Trade, value: string): string => `${trade}${SEPARATOR}${value}`;

export const PROBLEM_LABELLED: readonly Labelled<string>[] = Trade.options.flatMap((trade) =>
  Object.entries(PROBLEM_SAYINGS[trade] ?? {}).flatMap(([value, sayings]) =>
    sayings.map((said) => ({ said, label: label(trade, value) })),
  ),
);

/** The index over the problem sayings for one embedder; the app keeps one for its life. */
export const problemIndex = (embedder: Embedder): MeaningIndex<string> => new MeaningIndex(embedder, PROBLEM_LABELLED);

/**
 * The kind of job a sentence most sounds like, among this trade's kinds, as a driver value; undefined when the trade
 * has no problem driver, nothing is close enough, or the device has no model.
 */
export async function problemByMeaning(
  index: MeaningIndex<string>,
  trade: Trade,
  text: string,
): Promise<string | undefined> {
  const spec = driverSpec(trade, DriverName.enum.problem);
  if (!text.trim() || spec?.kind !== DriverKind.choice) return undefined;
  const prefix = `${trade}${SEPARATOR}`;
  const found = await index.nearest(text, (l) => l.startsWith(prefix));
  if (!found || found.top < PROBLEM_MIN_SIMILARITY) return undefined;
  const value = found.label.slice(prefix.length);
  return spec.values.find((v) => v === value);
}
