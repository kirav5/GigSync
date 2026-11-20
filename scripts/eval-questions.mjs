// The worker's agent's questions (ADR 0063), from a real model: one request per group of work, each from a worker
// with a card, a line about their work and what they said they need to know. Prints what the model asked, what the
// guards dropped and why, so a person can judge whether each question fits this worker and this job; counts the
// requests left with nothing to ask and the questions that ask the household how long the work takes.
// Run with `pnpm eval:questions` (builds core first), against the model OLLAMA_URL and OLLAMA_MODEL name, as
// `pnpm eval:find` does.
import { askModel } from "../packages/core/dist/job/question-model.js";
import { OLLAMA_MODEL, OLLAMA_URL, ollamaReady, RecordingModel } from "./eval-intent/ollama.mjs";

/** How long a question may take here: longer than the app waits, so a slow tunnel is not scored as "no questions". */
const WAIT_MS = 20_000;
const MAX = 3;

const CASES = [
  {
    work: "Fridge repair",
    need: "Fridge not cooling since yesterday",
    worker: {
      works: ["electrician", "Fridge repair"],
      about: "Fridges and washing machines, all brands",
      asks: ["brand", "single or double door"],
    },
  },
  { work: "Fridge repair", need: "fridge making noise", worker: { works: ["Fridge repair"] } },
  {
    work: "electrician",
    need: "Ceiling fan stopped working",
    worker: { works: ["electrician"], asks: ["which floor"] },
  },
  { work: "plumber", need: "kitchen sink blocked", worker: { works: ["plumber"], about: "20 years, all pipe work" } },
  { work: "AC repair", need: "AC dripping water inside", worker: { works: ["ac_technician"] } },
  { work: "TV repair", need: "TV has sound but no picture", worker: { works: ["TV repair"], asks: ["LED or LCD"] } },
  { work: "Washing machine repair", need: "machine not spinning", worker: { works: ["Washing machine repair"] } },
  {
    work: "cook",
    need: "cook for family dinner every day",
    worker: { works: ["cook"], about: "North Indian, Jain food" },
  },
  { work: "maid", need: "cleaning 3 days a week", worker: { works: ["maid"], asks: ["how many bathrooms"] } },
  { work: "Babysitter", need: "someone to look after my son after school", worker: { works: ["Babysitter"] } },
  { work: "Elder care", need: "care for my mother at home, she uses a walker", worker: { works: ["Elder care"] } },
  { work: "Pet care", need: "walk my dog twice a day", worker: { works: ["Pet care"], asks: ["size of the dog"] } },
  { work: "Tailor", need: "stitch two blouses", worker: { works: ["Tailor"], about: "Blouses and kurtas" } },
  { work: "Beautician", need: "bridal makeup at home", worker: { works: ["Beautician", "Mehendi artist"] } },
  { work: "Bike mechanic", need: "bike not starting in the morning", worker: { works: ["Bike mechanic"] } },
  { work: "driver", need: "driver to office and back, weekdays", worker: { works: ["driver"] } },
  { work: "Gardener", need: "trim the hedge and mow the lawn", worker: { works: ["Gardener"] } },
  { work: "Packers and movers", need: "moving a 2BHK across the city", worker: { works: ["Packers and movers"] } },
  { work: "School tutor", need: "maths tuition for class 8", worker: { works: ["School tutor"], asks: ["board"] } },
  { work: "painter", need: "paint two bedrooms", worker: { works: ["painter"] } },
  { work: "carpenter", need: "wardrobe door hinge broken", worker: { works: ["carpenter"] } },
  { work: "Event decorator", need: "balloon decoration for a birthday", worker: { works: ["Event decorator"] } },
];

if (!(await ollamaReady())) {
  console.error(`No model at ${OLLAMA_URL} (${OLLAMA_MODEL}).`);
  process.exit(1);
}

let empty = 0;
let workerCall = 0;
for (const c of CASES) {
  const model = new RecordingModel();
  const input = { ...c, details: {}, memory: "", known: [], max: MAX };
  const { kept, dropped } = await askModel(model, input, WAIT_MS);
  await model.settled();
  if (kept.length === 0) empty++;
  workerCall += dropped.filter((d) => d.reason === "worker_call").length;
  console.log(`\n${c.work}: ${JSON.stringify(c.need)} (worker: ${c.worker.works.join(", ")})`);
  for (const q of kept) console.log(`  ✓ ${q.text}`);
  for (const d of dropped) console.log(`  ✗ ${d.reason}: ${d.text}`);
}
console.log(`\n${CASES.length} requests: ${empty} with nothing to ask, ${workerCall} "how long" questions dropped.`);
