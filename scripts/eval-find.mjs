// The Find conversation eval: every conversation in vectors/find through the real interview and a real model, scored
// on what went wrong in Find's first real tests: the wrong job, a question asked twice, "Sorry, I didn't catch that",
// and chats that end nowhere. The intent eval scores one message; this scores the whole chat.
// Run with `pnpm eval:find` (builds core first). GigSync's model through its tunnel needs OLLAMA_URL, OLLAMA_MODEL,
// MODEL_ACCESS_ID and MODEL_ACCESS_SECRET in the environment. Options:
//   --reader R   what reads a message: `lists` (the three prompts and word lists) or `turn` (one reader), default lists
//   --set SET    only one set: en, hi, kn, hinglish or kanglish
//   --limit N    only the first N of each set
//   --json FILE  also write every conversation's record
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { LANG_OF, loadConversations, SETS } from "./eval-find/cases.mjs";
import { Reader, runConversation } from "./eval-find/flow.mjs";
import { line, repeatsIn, rightJob } from "./eval-find/score.mjs";
import { OLLAMA_MODEL, OLLAMA_URL, ollamaReady, RecordingModel } from "./eval-intent/ollama.mjs";

/** Each prompt by the words it opens with, so the calls of a chat can be counted by kind. */
const PROMPT_OF = {
  read: "You read one message",
  price: "A household in India wants",
  scope: "Read this request for a",
  jobType: "Is this request for one of",
  sameWork: "Which of these names that workers",
  need: "",
};
const kindOf = (prompt) => Object.keys(PROMPT_OF).find((k) => prompt.startsWith(PROMPT_OF[k]));

const { values } = parseArgs({
  options: { reader: { type: "string" }, set: { type: "string" }, limit: { type: "string" }, json: { type: "string" } },
});
const sets = values.set ? [values.set] : SETS;
if (!(await ollamaReady())) {
  console.error(`No ${OLLAMA_MODEL} at ${new URL(OLLAMA_URL).host}.`);
  process.exit(1);
}
const limit = values.limit ? Number(values.limit) : Number.POSITIVE_INFINITY;
const runs = [];
for (const set of sets) {
  for (const conversation of loadConversations([set]).slice(0, limit)) {
    const model = new RecordingModel();
    const record = await runConversation(model, conversation, LANG_OF[set], values.reader ?? Reader.lists);
    await model.settled();
    runs.push({
      ...conversation,
      ...record,
      ms: model.calls.map((c) => Math.round(c.ms)),
      kinds: model.calls.map((c) => kindOf(c.prompt)),
    });
    process.stdout.write(rightJob(conversation.want, record.job) && record.end === "ready" ? "." : "x");
  }
}
console.log("\n");
for (const set of sets)
  console.log(
    line(
      set,
      runs.filter((r) => r.set === set),
    ),
  );
console.log(line("all", runs));
const times = runs.flatMap((r) => r.ms).sort((a, b) => a - b);
console.log(`\n${times.length} model calls, median ${times[times.length >> 1]} ms, slowest ${times.at(-1)} ms`);
const chats = runs.length;
console.log(`${(times.length / chats).toFixed(1)} calls a chat, ${Math.max(...runs.map((r) => r.ms.length))} at most`);
for (const kind of Object.keys(PROMPT_OF)) {
  const used = runs.flatMap((r) => r.ms.filter((_, i) => r.kinds[i] === kind)).sort((a, b) => a - b);
  if (used.length > 0)
    console.log(`  ${kind}: ${(used.length / chats).toFixed(2)} a chat, median ${used[used.length >> 1]} ms`);
}
const worst = runs.filter(
  (r) => !rightJob(r.want, r.job) || r.end !== "ready" || repeatsIn(r.asked) > 0 || r.sorries > 0,
);
console.log(`\n${worst.length} with something wrong:`);
for (const r of worst.slice(0, 40))
  console.log(`  ${r.id}: job=${JSON.stringify(r.job)} end=${r.end} repeats=${repeatsIn(r.asked)} sorry=${r.sorries}`);
if (values.json) writeFileSync(values.json, JSON.stringify(runs, null, 1));
