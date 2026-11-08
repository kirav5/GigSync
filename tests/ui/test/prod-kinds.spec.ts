import { Lang } from "@gigsync/protocol";
import { type BrowserContext, test } from "@playwright/test";
import { newPhone, open, openCard, Role, RUN, signIn } from "./helpers.js";
import { AREA, agentsTalk, askInFind, askWorker, buildCard } from "./prod-drivers.js";
import { PERSONAS } from "./prod-kinds-data.js";
import { RUN_DIR, recordModel, saveKind, snap, turnsOf } from "./prod-run.js";

/**
 * Every kind of work, end to end on the production data and model (run only with PROD_KINDS=1): a worker makes their
 * card by chat, a household asks for that work by chat, finds them and asks, the agents talk, and both sign. Each kind
 * keeps its chats turn by turn (agent lines marked fixed or model-written), every model call with prompt and reply,
 * and screenshots of both phones, under tests/ui/prod-runs/<run>/. Point it at the dev servers on Neon and the Mac
 * Studio: APP_URL=http://localhost:5173 API_BASE=http://localhost:8787.
 */

const en = Lang.enum.en;
/** How long the agents may take from Ask to both signed before the kind is reported as not agreed. */
const TALK_MS = 5 * 60_000;
const KIND_MS = 15 * 60_000;
const ONLY = process.env.PROD_KINDS_ONLY?.split(",");

test.describe.configure({ mode: "parallel" });
test.skip(!process.env.PROD_KINDS, "the production run: set PROD_KINDS=1 and point APP_URL/API_BASE at Neon");

for (const p of PERSONAS.filter((x) => !ONLY || ONLY.includes(x.kind))) {
  test(`${p.kind}: a worker's card by chat, a household finds them by chat, the agents agree`, async ({ browser }) => {
    test.setTimeout(KIND_MS);
    const contexts: BrowserContext[] = [await browser.newContext(), await browser.newContext()];
    const [worker, home] = await Promise.all(contexts.map((c) => c.newPage()));
    if (!worker || !home) throw new Error("no pages");
    const record: Record<string, unknown> = { kind: p.kind, run: RUN, started: new Date().toISOString(), shots: [] };
    const shots = record.shots as string[];
    const step = (name: string) => {
      record.step = name;
    };
    recordModel(worker, p.kind, "worker");
    recordModel(home, p.kind, "customer");
    const workerName = `${p.kind.replaceAll("_", " ")} ${RUN}`;
    try {
      step("worker card");
      const cardStart = Date.now();
      await signIn(worker, { role: Role.worker, name: workerName, phone: newPhone(), lang: en });
      await buildCard(worker, p);
      record.card_ms = Date.now() - cardStart;
      record.worker_chat = await turnsOf(worker.getByRole("log"));
      shots.push(await snap(worker, p.kind, "1-worker-card-chat"));
      await openCard(worker, en);
      shots.push(await snap(worker, p.kind, "2-worker-card-form"));

      step("household find");
      const findStart = Date.now();
      await signIn(home, {
        role: Role.consumer,
        name: `Home ${p.kind.replaceAll("_", " ")} ${RUN}`,
        phone: newPhone(),
        lang: en,
        address: "House 12, 3rd Cross",
        area: AREA,
      });
      await askInFind(home, p);
      record.find_ms = Date.now() - findStart;
      record.customer_chat = await turnsOf(home.getByRole("log"));
      shots.push(await snap(home, p.kind, "3-customer-find-chat"));
      const found = await askWorker(home, workerName);
      record.found = found;
      shots.push(await snap(home, p.kind, "4-customer-results"));
      if (!found) throw new Error("the search did not list this kind's worker");

      step("agents talk");
      const talkStart = Date.now();
      const talk = await agentsTalk(worker, home, p, TALK_MS);
      record.talk_ms = Date.now() - talkStart;
      record.questions = talk.questions;
      record.stuck = talk.stuck;
      record.signed = talk.signed;
      await open(home, "nav.activity", en);
      shots.push(await snap(home, p.kind, "5-customer-job"));
      shots.push(await snap(worker, p.kind, "6-worker-job"));
      record.worker_talk = await worker
        .getByRole("list", { name: /./ })
        .first()
        .innerText()
        .catch(() => "");
      record.outcome = talk.signed ? "signed" : "talked, not signed";
    } catch (err) {
      record.outcome = "stopped";
      record.error = err instanceof Error ? err.message.split("\n")[0] : String(err);
      for (const [page, side] of [
        [worker, "worker"],
        [home, "customer"],
      ] as const)
        shots.push(await snap(page, p.kind, `x-${side}-at-stop`).catch(() => ""));
      record.worker_chat ??= await turnsOf(worker.getByRole("log")).catch(() => []);
      record.customer_chat ??= await turnsOf(home.getByRole("log")).catch(() => []);
    } finally {
      record.finished = new Date().toISOString();
      record.dir = RUN_DIR;
      saveKind(p.kind, record);
      await Promise.all(contexts.map((c) => c.close()));
    }
  });
}
