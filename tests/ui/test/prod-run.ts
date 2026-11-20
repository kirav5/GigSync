import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import type { Locator, Page, Request } from "@playwright/test";
import { en } from "../../../packages/core/dist/i18n/en/index.js";

/**
 * What the production run (prod-kinds.spec.ts) keeps for each kind: every model call either phone made to the
 * development build's Ollama (adapters/ollama.ts), with its prompt, reply, purpose and timing (model-calls.jsonl), each chat as turns, and each agent line marked as the app's
 * own fixed words or the model's. Written under tests/ui/prod-runs/<run>/, which git ignores.
 */

export const RUN_ID = process.env.PROD_RUN_ID ?? new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
export const RUN_DIR = new URL(`../prod-runs/${RUN_ID}/`, import.meta.url).pathname;
const MODEL_LOG = `${RUN_DIR}model-calls.jsonl`;
const CONSOLE_LOG = `${RUN_DIR}console.jsonl`;
/** Ollama's endpoint, which a development build given `VITE_OLLAMA_MODEL` calls. */
const GENERATE = "/api/generate";

/** Each prompt by the words it opens with: Ollama's request carries no purpose. */
const PROMPT_OPENS: ReadonlyArray<readonly [string, string]> = [
  ["You read one message", "read_turn"],
  ["A household in India wants", "price"],
  ["Read this request for a", "scope"],
  ["Is this request for one of", "job_type"],
  ["Which of these names that workers", "same_work"],
  ["You are the assistant of a worker", "worker_questions"],
  ["Reword this note", "explain"],
];

export type Side = "worker" | "customer";

/** Records every model call `page` makes, as one JSON line each, until the page closes. */
export function recordModel(page: Page, kind: string, side: Side): void {
  mkdirSync(RUN_DIR, { recursive: true });
  // The phone's own log lines (model calls, warnings, errors) beside the network's view, for when the two disagree.
  page.on("console", (msg) => {
    if (msg.type() === "debug") return;
    appendFileSync(CONSOLE_LOG, `${JSON.stringify({ kind, side, at: new Date().toISOString(), text: msg.text() })}\n`);
  });
  page.on("requestfinished", (req) => void logCall(req, kind, side));
  page.on("requestfailed", (req) => {
    if (req.url().endsWith(GENERATE))
      line({ kind, side, at: new Date().toISOString(), failed: req.failure()?.errorText });
  });
}

const line = (entry: Record<string, unknown>) => appendFileSync(MODEL_LOG, `${JSON.stringify(entry)}\n`);

/** What Ollama's reply carries that the run keeps: the answer and its token counts. */
interface OllamaReply {
  response?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

async function logCall(req: Request, kind: string, side: Side) {
  if (!req.url().endsWith(GENERATE)) return;
  const sent = (req.postDataJSON() ?? {}) as { prompt?: string; options?: { num_predict?: number } };
  const res = await req.response();
  const body = res ? ((await res.json().catch(() => ({}))) as OllamaReply) : {};
  const timing = req.timing();
  const prompt = sent.prompt ?? "";
  const purpose = PROMPT_OPENS.find(([opens]) => prompt.startsWith(opens))?.[1] ?? "unknown";
  line({
    kind,
    side,
    at: new Date().toISOString(),
    purpose,
    ms: Math.round(timing.responseEnd),
    status: res?.status(),
    max_tokens: sent.options?.num_predict,
    usage: { prompt_tokens: body.prompt_eval_count, reply_tokens: body.eval_count },
    prompt,
    reply: body.response ?? null,
  });
}

/** The app's own fixed lines in English, as patterns where their `{name}`s stand for anything. */
const FIXED = Object.entries(en as Record<string, string>)
  .filter(([key]) =>
    /^(need|driver|iv|skill|terms|addr|estimate|find|when|flag|job|question|ask|talk|explain)\./.test(key),
  )
  .map(([key, text]) => ({
    key,
    re: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{\w+\\\}/g, ".+?")),
  }))
  .filter(({ re }) => re.source.length > 12);

export interface Turn {
  who: "agent" | "person";
  text: string;
  /** For the agent's lines: the fixed keys it matched; empty means the model wrote it. */
  fixed?: string[];
}

/** A chat's turns in order, each agent line marked as the app's fixed words or the model's. */
export async function turnsOf(log: Locator): Promise<Turn[]> {
  const items = await log.locator(".msg-agent:not(.thinking), .msg-user").all();
  const turns: Turn[] = [];
  for (const item of items) {
    const agent = ((await item.getAttribute("class")) ?? "").includes("msg-agent");
    const text = ((await item.innerText()).trim() || "").replace(/\s+\n/g, "\n");
    if (!text) continue;
    turns.push(
      agent
        ? { who: "agent", text, fixed: FIXED.filter(({ re }) => re.test(text)).map((f) => f.key) }
        : {
            who: "person",
            text,
          },
    );
  }
  return turns;
}

/** One kind's record, as JSON beside its screenshots. */
export function saveKind(kind: string, record: Record<string, unknown>): void {
  mkdirSync(`${RUN_DIR}${kind}`, { recursive: true });
  writeFileSync(`${RUN_DIR}${kind}/record.json`, JSON.stringify(record, null, 2));
}

/** A screenshot of one phone, under the kind's folder. */
export async function snap(page: Page, kind: string, name: string): Promise<string> {
  mkdirSync(`${RUN_DIR}${kind}`, { recursive: true });
  const path = `${RUN_DIR}${kind}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  return `${kind}/${name}.png`;
}
