import type { Call } from "./corpus.js";

/**
 * One call to Ollama on GigSync's computer, straight through its tunnel, in the body the API sends
 * (workers/api/src/routes/model.ts `ollamaBody`). Nothing else changes, never `num_ctx` above all: a different context
 * size makes Ollama load the model again, and every phone waits through it.
 */

export interface ModelTarget {
  origin: string;
  name: string;
  /** Cloudflare Access service-token headers. */
  headers: Record<string, string>;
}

/** What one call cost, from the client's clock and Ollama's own counts. */
export interface Sample {
  /** Milliseconds from the start of the step. */
  at: number;
  purpose: string;
  ok: boolean;
  status: number;
  ms: number;
  /** Until the first token arrived (streamed calls only), queueing included. */
  firstMs?: number;
  error?: string;
  loadMs?: number;
  promptTokens?: number;
  promptMs?: number;
  replyTokens?: number;
  replyMs?: number;
  /** Ollama's own total: from taking the request off its queue to the last token. */
  ollamaMs?: number;
}

const GENERATE_PATH = "/api/generate";
/** As the API asks (MODEL_KEEP_ALIVE): the load test must not change how long the model stays loaded. */
const KEEP_ALIVE = "24h";
const NS_PER_MS = 1_000_000;
const CONTENT_TYPE = { "Content-Type": "application/json" } as const;

/** Ollama's last (or only) reply object: its counts, durations in nanoseconds. */
interface OllamaDone {
  response?: string;
  done?: boolean;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
  total_duration?: number;
}

const body = (target: ModelTarget, call: Call, stream: boolean) => ({
  model: target.name,
  prompt: call.prompt,
  stream,
  think: false,
  keep_alive: KEEP_ALIVE,
  ...(call.format === undefined ? {} : { format: call.format }),
  options: {
    num_predict: call.maxTokens,
    ...(call.temperature === undefined ? {} : { temperature: call.temperature }),
  },
});

const ms = (ns: number | undefined) => (ns === undefined ? undefined : Math.round(ns / NS_PER_MS));

function countsOf(done: OllamaDone): Partial<Sample> {
  const counts = {
    loadMs: ms(done.load_duration),
    promptTokens: done.prompt_eval_count,
    promptMs: ms(done.prompt_eval_duration),
    replyTokens: done.eval_count,
    replyMs: ms(done.eval_duration),
    ollamaMs: ms(done.total_duration),
  };
  return Object.fromEntries(Object.entries(counts).filter(([, v]) => v !== undefined));
}

/** Reads a streamed reply line by line: when its first token came, and the final object with the counts. */
async function readStream(res: Response, started: number): Promise<{ firstMs?: number; done: OllamaDone }> {
  if (!res.body) return { done: {} };
  const decoder = new TextDecoder();
  let buffered = "";
  let firstMs: number | undefined;
  let done: OllamaDone = {};
  const reader = res.body.getReader();
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    buffered += decoder.decode(chunk.value, { stream: true });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    for (const line of lines.filter((l) => l.trim())) {
      const part = JSON.parse(line) as OllamaDone;
      if (firstMs === undefined && part.response) firstMs = performance.now() - started;
      if (part.done) done = part;
    }
  }
  return { ...(firstMs === undefined ? {} : { firstMs: Math.round(firstMs) }), done };
}

/** Sends one call and measures it; never throws. `stream` adds the first token's time; Ollama's work is the same. */
export async function generate(
  target: ModelTarget,
  call: Call,
  opts: { stream: boolean; timeoutMs: number; stepStart: number },
): Promise<Sample> {
  const started = performance.now();
  const base = { at: Math.round(started - opts.stepStart), purpose: call.purpose };
  try {
    const res = await fetch(`${target.origin}${GENERATE_PATH}`, {
      method: "POST",
      headers: { ...CONTENT_TYPE, ...target.headers },
      body: JSON.stringify(body(target, call, opts.stream)),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) {
      await res.body?.cancel();
      return { ...base, ok: false, status: res.status, ms: Math.round(performance.now() - started) };
    }
    const { firstMs, done } = opts.stream
      ? await readStream(res, started)
      : { firstMs: undefined, done: (await res.json()) as OllamaDone };
    const elapsed = Math.round(performance.now() - started);
    return {
      ...base,
      ok: true,
      status: res.status,
      ms: elapsed,
      ...(firstMs === undefined ? {} : { firstMs }),
      ...countsOf(done),
    };
  } catch (err) {
    const error = err instanceof Error ? err.name : typeof err;
    return { ...base, ok: false, status: 0, ms: Math.round(performance.now() - started), error };
  }
}
