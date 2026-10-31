// Runs each case through the three routers core exports (ADR 0040): the word lists, the model alone, and the chain
// the app uses. Every model call is made fresh and one at a time, so latencies are the model's own.
import { contextOf } from "./cases.mjs";
import { core } from "./core.mjs";
import { fallbackReason } from "./fallback.mjs";
import { RecordingModel } from "./ollama.mjs";
import { slotHits } from "./score.mjs";

/** The routers, as the report names them: the lists, the embedding model (ADR 0042), the language model, the app's chain. */
export const Router = { keywords: "keywords", meaning: "meaning", model: "model", combined: "combined" };

/** What one router said for one case, scored against the expected intent and slots. */
function scored(c, route, ms) {
  const { hits, total, missed } = slotHits(c.slots ?? {}, route?.slots ?? {});
  return {
    intent: route?.intent,
    slots: route?.slots ?? {},
    via: route?.via,
    ok: route?.intent === c.intent,
    hits,
    total,
    missed,
    ms,
  };
}

async function timed(work) {
  const started = performance.now();
  const value = await work();
  return { value, ms: performance.now() - started };
}

async function runModel(c, ctx, timeoutMs, ask) {
  const model = new RecordingModel(ask);
  const { value, ms } = await timed(() => core.modelRoute(c.text, ctx, model, { timeoutMs }));
  await model.settled();
  const result = scored(c, value, ms);
  result.rawMs = model.calls.reduce((sum, call) => sum + call.ms, 0);
  if (!value) result.fallback = fallbackReason(model.calls, ms, timeoutMs, c.text, ctx);
  result.reply = model.calls.at(-1)?.reply ?? undefined;
  return result;
}

async function runMeaning(c, ctx, meaning) {
  const { value, ms } = await timed(() => core.meaningRoute(c.text, ctx, meaning.intents));
  return scored(c, value, ms);
}

/** The chain the app runs: the embedding index when there is one, the language model when asked for, the lists. */
async function runCombined(c, ctx, timeoutMs, withModel, meaning, ask) {
  const model = withModel ? new RecordingModel(ask) : new core.NoModel();
  const opts = { timeoutMs, ...(meaning ? { meaning: meaning.intents } : {}) };
  const { value, ms } = await timed(() => core.routeChat(c.text, ctx, model, opts));
  if (withModel) await model.settled();
  return scored(c, value, ms);
}

/** The routers a run reports, in the report's order. */
export function routersOf({ withModel, meaning }) {
  return Object.values(Router).filter(
    (r) =>
      r === Router.keywords ||
      (r === Router.meaning && meaning) ||
      (r === Router.model && withModel) ||
      (r === Router.combined && (withModel || meaning)),
  );
}

/**
 * Every case through each router; without `withModel` and `meaning` only the word lists run. `ask` picks the
 * language model's engine (Ollama unless given).
 */
export async function runAll(cases, { withModel, meaning, timeoutMs, onProgress, ask }) {
  const results = [];
  for (const [i, c] of cases.entries()) {
    const ctx = contextOf(c);
    const keywords = await timed(async () => core.keywordRoute(c.text, ctx));
    const result = { case: c, [Router.keywords]: scored(c, keywords.value, keywords.ms) };
    if (meaning) result[Router.meaning] = await runMeaning(c, ctx, meaning);
    if (withModel) result[Router.model] = await runModel(c, ctx, timeoutMs, ask);
    if (withModel || meaning) result[Router.combined] = await runCombined(c, ctx, timeoutMs, withModel, meaning, ask);
    results.push(result);
    onProgress?.(i + 1, cases.length);
  }
  return results;
}
