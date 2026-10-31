import { WORTH_ASKING } from "@gigsync/core";
import { Confidence, type DriverName, EstimateBasisKind } from "@gigsync/protocol";

/**
 * How sure a range is (ADR 0041 §3), from what its rate rests on and how many of the drivers that move the price were
 * assumed. Strong: GigSync jobs weighing at least `STRONG_EFFECTIVE`. Fair: GigSync jobs past the thresholds. Weak:
 * the rate card alone. High needs strong rates and nothing material assumed.
 */

/** Effective jobs (recency-weighted) for GigSync's rate to count as strong. ASSUMED. */
export const STRONG_EFFECTIVE = 30;
/**
 * An assumed driver that spreads the range by at least this factor counts against the confidence: the same bar as a
 * driver worth asking about (core's `WORTH_ASKING`), so what was not worth a question does not lower the label.
 */
export const MATERIAL_WIDTH = WORTH_ASKING;

const K = EstimateBasisKind.enum;
const C = Confidence.enum;
const Strength = { weak: 0, fair: 1, strong: 2 } as const;

export interface ConfidenceInput {
  blend: readonly EstimateBasisKind[];
  /** GigSync's effective jobs; 0 when its rate is not in the blend. */
  effective: number;
  assumed: readonly DriverName[];
  widths: Readonly<Partial<Record<DriverName, number>>>;
}

export function confidenceOf(i: ConfidenceInput): Confidence {
  const gigsync = i.blend.includes(K.gigsync);
  const strength = !gigsync ? Strength.weak : i.effective >= STRONG_EFFECTIVE ? Strength.strong : Strength.fair;
  const material = i.assumed.filter((name) => (i.widths[name] ?? 1) >= MATERIAL_WIDTH).length;
  if (strength === Strength.strong && material === 0) return C.high;
  if ((strength >= Strength.fair && material <= 1) || (strength === Strength.weak && material === 0)) return C.medium;
  return C.low;
}
