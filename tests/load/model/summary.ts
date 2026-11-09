import { type Spread, shareOver, spread, table } from "../lib/stats.js";
import type { Sample } from "./ollama.js";
import type { Loaded } from "./step.js";

/** The phone gives up on the server's model after this (apps/mobile/src/adapters/server-model.ts WAIT_MS). */
const PHONE_WAIT_MS = 4_000;
/** Core gives up on any model after this (packages/core/src/interview/need-model.ts MODEL_WAIT_MS). */
const CORE_WAIT_MS = 8_000;
const MS_PER_S = 1000;

export interface StepSummary {
  concurrency: number;
  calls: number;
  ok: number;
  errorShare: number;
  errors: Record<string, number>;
  /** Answered calls per second over the step, and reply tokens per second. */
  callsPerS: number;
  tokensPerS: number;
  total: Spread;
  first: Spread;
  ollama: Spread;
  /** Client time less Ollama's own and the network: waiting in Ollama's queue (or Cloudflare's), estimated. */
  queued: Spread;
  /** Ollama's total less its loading, reading and writing: time the call waited inside Ollama for a turn. */
  waitedInOllama: Spread;
  /** Loading, reading the prompt and writing the reply: the model's own work for one call. */
  compute: Spread;
  /** One call's decode speed, tokens per second: flat as concurrency rises means calls run one at a time. */
  decodePerS: Spread;
  overPhoneWait: number;
  overCoreWait: number;
  maxLoadMs: number;
  promptTokens: Spread;
  replyTokens: Spread;
  byPurpose: Record<string, Spread>;
  loaded: Loaded[];
}

const computeOf = (s: Sample) => (s.loadMs ?? 0) + (s.promptMs ?? 0) + (s.replyMs ?? 0);
const nums = (xs: (number | undefined)[]) => xs.filter((x): x is number => x !== undefined);

function errorsOf(samples: readonly Sample[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of samples.filter((x) => !x.ok)) {
    const key = s.error ?? String(s.status);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export function summarise(
  concurrency: number,
  samples: readonly Sample[],
  seconds: number,
  networkMs: number,
  loaded: Loaded[],
): StepSummary {
  const ok = samples.filter((s) => s.ok);
  const wallS = Math.max(seconds, Math.max(0, ...samples.map((s) => s.at + s.ms)) / MS_PER_S);
  const byPurpose: Record<string, Spread> = {};
  for (const purpose of new Set(ok.map((s) => s.purpose)))
    byPurpose[purpose] = spread(ok.filter((s) => s.purpose === purpose).map((s) => s.ms));
  const replyTokens = nums(ok.map((s) => s.replyTokens));
  return {
    concurrency,
    calls: samples.length,
    ok: ok.length,
    errorShare: samples.length ? (samples.length - ok.length) / samples.length : 0,
    errors: errorsOf(samples),
    callsPerS: Number((ok.length / wallS).toFixed(2)),
    tokensPerS: Number((replyTokens.reduce((a, b) => a + b, 0) / wallS).toFixed(1)),
    total: spread(ok.map((s) => s.ms)),
    first: spread(nums(ok.map((s) => s.firstMs))),
    ollama: spread(nums(ok.map((s) => s.ollamaMs))),
    queued: spread(nums(ok.map((s) => (s.ollamaMs === undefined ? undefined : s.ms - s.ollamaMs - networkMs)))),
    waitedInOllama: spread(nums(ok.map((s) => (s.ollamaMs === undefined ? undefined : s.ollamaMs - computeOf(s))))),
    compute: spread(ok.map(computeOf)),
    decodePerS: spread(
      nums(ok.map((s) => (s.replyTokens && s.replyMs ? (MS_PER_S * s.replyTokens) / s.replyMs : undefined))),
    ),
    // A failed call is one the phone did not get in time either.
    overPhoneWait: shareOver([...samples.map((s) => (s.ok ? s.ms : Number.POSITIVE_INFINITY))], PHONE_WAIT_MS),
    overCoreWait: shareOver([...samples.map((s) => (s.ok ? s.ms : Number.POSITIVE_INFINITY))], CORE_WAIT_MS),
    maxLoadMs: Math.max(0, ...nums(ok.map((s) => s.loadMs))),
    promptTokens: spread(nums(ok.map((s) => s.promptTokens))),
    replyTokens: spread(replyTokens),
    byPurpose,
    loaded,
  };
}

const COLUMNS = [
  "at once",
  "calls",
  "err%",
  "calls/s",
  "tok/s",
  "p50",
  "p90",
  "p99",
  "first p50",
  "first p90",
  "ollama p50",
  "compute p50",
  "wait p50",
  "wait p90",
  "decode t/s",
  ">4s %",
  ">8s %",
  "load max",
] as const;

export function printSteps(steps: readonly StepSummary[]): void {
  const rows = steps.map((s) => ({
    "at once": s.concurrency,
    calls: s.calls,
    "err%": Math.round(1000 * s.errorShare) / 10,
    "calls/s": s.callsPerS,
    "tok/s": s.tokensPerS,
    p50: s.total.p50,
    p90: s.total.p90,
    p99: s.total.p99,
    "first p50": s.first.p50,
    "first p90": s.first.p90,
    "ollama p50": s.ollama.p50,
    "compute p50": s.compute.p50,
    "wait p50": s.waitedInOllama.p50,
    "wait p90": s.waitedInOllama.p90,
    "decode t/s": s.decodePerS.p50,
    ">4s %": s.overPhoneWait,
    ">8s %": s.overCoreWait,
    "load max": s.maxLoadMs,
  }));
  console.log(table(rows, COLUMNS));
}
