// Sums up a production run (test/prod-kinds.spec.ts) for its report: per kind, how far it got, how long each part
// took, its chats with every agent line marked fixed or model-written, the questions the worker's agent asked, and the
// model calls by purpose; across the run, the model's time and tokens by purpose. Writes summary.json beside the run.
// Run with `node prod-report.mjs <run id>` from tests/ui.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const run = process.argv[2] ?? "all-kinds";
const dir = new URL(`./prod-runs/${run}/`, import.meta.url).pathname;
const calls = existsSync(`${dir}model-calls.jsonl`)
  ? readFileSync(`${dir}model-calls.jsonl`, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  : [];

const median = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : 0);
const p90 = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.9)] : 0);
const agentLines = (chat = []) => chat.filter((t) => t.who === "agent");

const kinds = readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(`${dir}${d.name}/record.json`))
  .map((d) => JSON.parse(readFileSync(`${dir}${d.name}/record.json`, "utf8")))
  .map((r) => {
    // A kind run again keeps only its last attempt's calls, the ones made between its start and finish.
    const within = (c) => !r.started || !r.finished || (c.at >= r.started && c.at <= r.finished);
    const mine = calls.filter((c) => c.kind === r.kind && within(c));
    const byPurpose = {};
    for (const c of mine) byPurpose[`${c.side}:${c.purpose}`] = (byPurpose[`${c.side}:${c.purpose}`] ?? 0) + 1;
    const lines = [...agentLines(r.worker_chat), ...agentLines(r.customer_chat)];
    return {
      kind: r.kind,
      outcome: r.outcome,
      step: r.step,
      error: r.error,
      found: r.found,
      signed: r.signed,
      card_s: Math.round((r.card_ms ?? 0) / 1000),
      find_s: Math.round((r.find_ms ?? 0) / 1000),
      talk_s: Math.round((r.talk_ms ?? 0) / 1000),
      worker_turns: agentLines(r.worker_chat).length,
      customer_turns: agentLines(r.customer_chat).length,
      fixed_lines: lines.filter((t) => t.fixed?.length).length,
      model_lines: lines.filter((t) => !t.fixed?.length).length,
      questions: r.questions ?? [],
      stuck: r.stuck ?? [],
      model_calls: mine.length,
      model_ms: mine.reduce((s, c) => s + (c.ms ?? 0), 0),
      by_purpose: byPurpose,
      worker_chat: r.worker_chat ?? [],
      customer_chat: r.customer_chat ?? [],
      shots: r.shots ?? [],
    };
  })
  .sort((a, b) => a.kind.localeCompare(b.kind));

const purposes = {};
for (const c of calls) {
  const key = c.purpose ?? "unknown";
  purposes[key] ??= { calls: 0, ms: [], prompt_tokens: [], reply_tokens: [], empty: 0, failed: 0 };
  const p = purposes[key];
  p.calls++;
  if (c.failed || (c.status && c.status >= 400)) p.failed++;
  else if (c.reply === null) p.empty++;
  if (c.ms) p.ms.push(c.ms);
  if (c.usage?.prompt_tokens) p.prompt_tokens.push(c.usage.prompt_tokens);
  if (c.usage?.reply_tokens) p.reply_tokens.push(c.usage.reply_tokens);
}
const byPurpose = Object.entries(purposes)
  .map(([purpose, p]) => ({
    purpose,
    calls: p.calls,
    share: calls.length ? Math.round((p.calls / calls.length) * 100) : 0,
    median_ms: median(p.ms),
    p90_ms: p90(p.ms),
    total_s: Math.round(p.ms.reduce((s, x) => s + x, 0) / 1000),
    median_prompt_tokens: median(p.prompt_tokens),
    median_reply_tokens: median(p.reply_tokens),
    empty: p.empty,
    failed: p.failed,
  }))
  .sort((a, b) => b.total_s - a.total_s);

const count = (f) => kinds.filter(f).length;
const summary = {
  run,
  kinds: kinds.length,
  signed: count((k) => k.signed),
  found: count((k) => k.found),
  stopped: count((k) => k.outcome === "stopped"),
  stopped_at: Object.fromEntries(
    [...new Set(kinds.filter((k) => k.outcome === "stopped").map((k) => k.step))].map((s) => [
      s,
      kinds.filter((k) => k.outcome === "stopped" && k.step === s).map((k) => k.kind),
    ]),
  ),
  agent_lines: {
    fixed: kinds.reduce((s, k) => s + k.fixed_lines, 0),
    model: kinds.reduce((s, k) => s + k.model_lines, 0),
  },
  median_s: {
    card: median(kinds.map((k) => k.card_s)),
    find: median(kinds.map((k) => k.find_s)),
    talk: median(kinds.filter((k) => k.talk_s).map((k) => k.talk_s)),
  },
  model_calls: calls.length,
  by_purpose: byPurpose,
  kinds_detail: kinds,
};
writeFileSync(`${dir}summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, kinds_detail: undefined }, null, 2));
