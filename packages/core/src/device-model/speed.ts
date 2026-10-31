import { MODEL_ROUTE_TIMEOUT_MS } from "../router/model-route.js";

/**
 * The speed guard (ADR 0040 amendment): a phone whose model keeps missing the router's time limit is no help, only a
 * wait before the word lists answer anyway. The first routing answers on a device are timed; when SLOW_VERDICT of
 * the first SPEED_SAMPLES take longer than the limit, Auto stops using the model there until the owner taps "Try
 * again". Only routing answers count: a longer piece of writing is allowed to take longer.
 */

/** How many first answers decide. */
export const SPEED_SAMPLES = 5;
/** How many of them over the limit make the phone too slow. */
export const SLOW_VERDICT = 3;

export const Speed = { measuring: "measuring", fast: "fast", slow: "slow" } as const;
export type Speed = (typeof Speed)[keyof typeof Speed];

/** What the guard knows on one device: the answer times so far (ms), and its verdict once there is one. */
export interface SpeedRecord {
  times: number[];
  verdict: Speed;
}

export const freshSpeed = (): SpeedRecord => ({ times: [], verdict: Speed.measuring });

/** The record after one more timed answer; a verdict, once reached, stands until `freshSpeed()` starts again. */
export function recordSpeed(record: SpeedRecord, ms: number, limitMs = MODEL_ROUTE_TIMEOUT_MS): SpeedRecord {
  if (record.verdict !== Speed.measuring || !Number.isFinite(ms) || ms < 0) return record;
  const times = [...record.times, ms];
  const slow = times.filter((t) => t > limitMs).length;
  if (slow >= SLOW_VERDICT) return { times, verdict: Speed.slow };
  return { times, verdict: times.length >= SPEED_SAMPLES ? Speed.fast : Speed.measuring };
}

export const tooSlow = (record: SpeedRecord | undefined) => record?.verdict === Speed.slow;
