/** Rounds to the nearest step, never to zero: a price is always at least one step. */
export const roundTo = (value: number, step: number): number => Math.max(step, Math.round(value / step) * step);
/** Rounds up to the step: for a legal floor, which must never be shown lower than it is. */
export const roundUpTo = (value: number, step: number): number => Math.ceil(value / step) * step;
