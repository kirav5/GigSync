import { type Spread, spread } from "../lib/stats.js";
import { type Corpus, draw } from "./corpus.js";
import { generate, type ModelTarget, type Sample } from "./ollama.js";

const VERSION_PATH = "/api/version";
const PS_PATH = "/api/ps";
const BASELINE_CALLS = 10;
const MS_PER_S = 1000;

/** The round trip to the tunnel with no model work: what every call pays before Ollama sees it. */
export async function baseline(target: ModelTarget): Promise<Spread> {
  const times: number[] = [];
  for (let i = 0; i < BASELINE_CALLS; i++) {
    const started = performance.now();
    const res = await fetch(`${target.origin}${VERSION_PATH}`, { headers: target.headers });
    await res.text();
    times.push(performance.now() - started);
  }
  // The first call opens the connection; the app's Worker keeps one open, so leave it out.
  return spread(times.slice(1));
}

export interface Loaded {
  name: string;
  sizeGb: number;
  contextLength?: number;
  expiresAt?: string;
}

const BYTES_PER_GB = 1e9;
const GB_DECIMALS = 1;

/** The models Ollama holds in memory now: a changed size or expiry between steps means it loaded the model again. */
export async function loadedModels(target: ModelTarget): Promise<Loaded[]> {
  try {
    const res = await fetch(`${target.origin}${PS_PATH}`, { headers: target.headers });
    const ps = (await res.json()) as {
      models?: { name: string; size_vram: number; context_length?: number; expires_at?: string }[];
    };
    return (ps.models ?? []).map((m) => ({
      name: m.name,
      sizeGb: Number((m.size_vram / BYTES_PER_GB).toFixed(GB_DECIMALS)),
      ...(m.context_length === undefined ? {} : { contextLength: m.context_length }),
      ...(m.expires_at === undefined ? {} : { expiresAt: m.expires_at }),
    }));
  } catch {
    return [];
  }
}

/**
 * Keeps `concurrency` calls in flight for `seconds`: each caller sends its next call the moment the last one ends.
 * Calls still in flight when time is up finish and count.
 */
export async function runStep(
  target: ModelTarget,
  corpus: Corpus,
  opts: { concurrency: number; seconds: number; timeoutMs: number; stream: boolean },
): Promise<Sample[]> {
  const stepStart = performance.now();
  const deadline = stepStart + opts.seconds * MS_PER_S;
  const samples: Sample[] = [];
  const caller = async () => {
    while (performance.now() < deadline) {
      samples.push(await generate(target, draw(corpus), { ...opts, stepStart }));
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency }, caller));
  return samples;
}
