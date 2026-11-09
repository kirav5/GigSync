import { readFileSync } from "node:fs";

/**
 * The prompts a load test sends: every model call a production run logged (tests/ui/prod-runs/<run>/model-calls.jsonl,
 * written by tests/ui/test/prod-kinds.spec.ts), drawn in the proportions real traffic has. The file stays out of git:
 * it holds test personas' chats.
 */

/** One logged call, as prod-kinds.spec.ts writes it. */
interface Logged {
  kind?: string;
  side?: string;
  purpose?: string;
  max_tokens?: number;
  prompt?: string;
  reply?: string | null;
}

/** One call to replay: what the phone sent, as the API forwards it to Ollama. */
export interface Call {
  purpose: string;
  /** Whose phone made it in the run: `worker` or `customer`. */
  side: string;
  prompt: string;
  maxTokens: number;
  temperature?: number;
  /** Ollama's `format`: a JSON schema, `json`, or absent for free text. */
  format?: unknown;
}

export interface Corpus {
  calls: Map<string, Call[]>;
  /** Each purpose's share of traffic, 0..1. */
  weights: Map<string, number>;
  /** How many kinds of work the run covered: one worker and one household each. */
  kinds: number;
}

/** Calls the phone holds to a JSON schema at temperature 0 (packages/core: read-turn, suggest, same-work, ...). */
const JSON_PURPOSES = new Set(["read_turn", "suggest_work", "first_question", "route", "same_work", "price"]);
/** Since #75 each offer note is worded once per model on a phone, so a repeat of the same prompt costs nothing. */
const CACHED_PER_PHONE = new Set(["explain"]);
const JSON_FALLBACK = "json";
const NULL_TYPE = "null";
/** A line of a list the prompt offers: "- Electrician: home wiring, ..." or "- TV repair". */
const LIST_LINE = /^- ([^:\n]+?)(?::|$)/gm;
/** What the schemas call "none of these" (packages/core/src/skills/suggest.ts NONE_OF_THEM). */
const NONE_LINE = /"(none[^"]*)"/i;

/** The names a prompt lists, for a schema's enum. */
const listed = (prompt: string) => [...prompt.matchAll(LIST_LINE)].map((m) => (m[1] ?? "").trim()).filter(Boolean);

/**
 * The schema the phone sent, rebuilt from the reply's shape: each key the reply has, its type, and for `work` the
 * names the prompt lists. The phone's own schemas are built in core from state the log does not keep; this keeps
 * the grammar Ollama enforces about as large, which is what costs time.
 */
function schemaOf(prompt: string, reply: string | null | undefined): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply ?? "");
  } catch {
    return JSON_FALLBACK;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return JSON_FALLBACK;
  const names = listed(prompt);
  const none = prompt.match(NONE_LINE)?.[1];
  const properties = Object.fromEntries(
    Object.entries(parsed).map(([key, value]) => {
      if (key === "work" && names.length > 0) return [key, { enum: [...names, ...(none ? [none] : []), null] }];
      const type = value === null ? ["string", NULL_TYPE] : typeof value;
      return [key, { type }];
    }),
  );
  return { type: "object", properties, required: Object.keys(properties) };
}

function callOf(r: Required<Pick<Logged, "purpose" | "prompt">> & Logged): Call {
  const json = JSON_PURPOSES.has(r.purpose);
  return {
    purpose: r.purpose,
    side: r.side ?? "",
    prompt: r.prompt,
    maxTokens: r.max_tokens ?? 0,
    ...(json ? { temperature: 0, format: schemaOf(r.prompt, r.reply) } : {}),
  };
}

/** Reads a run's model-calls.jsonl into calls by purpose, with each purpose's share after the per-phone cache. */
export function loadCorpus(path: string): Corpus {
  const rows = readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Logged)
    .filter((r): r is Required<Pick<Logged, "purpose" | "prompt">> & Logged => Boolean(r.purpose && r.prompt));
  const seen = new Set<string>();
  const calls = new Map<string, Call[]>();
  for (const r of rows) {
    if (CACHED_PER_PHONE.has(r.purpose)) {
      const key = JSON.stringify([r.kind, r.side, r.prompt]);
      if (seen.has(key)) continue;
      seen.add(key);
    }
    calls.set(r.purpose, [...(calls.get(r.purpose) ?? []), callOf(r)]);
  }
  const total = [...calls.values()].reduce((n, list) => n + list.length, 0);
  const weights = new Map([...calls].map(([purpose, list]) => [purpose, list.length / total]));
  return { calls, weights, kinds: new Set(rows.map((r) => r.kind)).size };
}

/** One side's calls, in the run's mix: what one person's journey asks of the model. */
export const sideCalls = (corpus: Corpus, side: string): Call[] =>
  [...corpus.calls.values()].flat().filter((c) => c.side === side);

/** One call drawn at random: a purpose by its share, then one of its logged prompts. */
export function draw(corpus: Corpus, random: () => number = Math.random): Call {
  let left = random();
  for (const [purpose, weight] of corpus.weights) {
    left -= weight;
    if (left <= 0) return pick(corpus.calls.get(purpose) ?? [], random);
  }
  return pick([...corpus.calls.values()].flat(), random);
}

function pick(list: readonly Call[], random: () => number): Call {
  const call = list[Math.floor(random() * list.length)];
  if (!call) throw new Error("empty corpus");
  return call;
}
