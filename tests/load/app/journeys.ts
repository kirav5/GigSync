import { TaskKind, type WorkerRules } from "@gigsync/core";
import { type EngagementId, EngagementStatus, type Place, type Trade, type UserId } from "@gigsync/protocol";
import type { Call } from "../model/corpus.js";
import { askModel, type Phone, publishCard } from "./people.js";

/**
 * What people do in the app, done by simulated phones: a worker builds a card and keeps the app open; a household
 * finds workers, asks two, answers their questions and signs. Both check their mailbox every SYNC_MS while open, as
 * the app does (apps/mobile/src/useGig.ts), and ask the model what their side asked in the production run.
 */

/** As often as the app checks its mailbox while open (apps/mobile/src/useGig.ts SYNC_MS). */
export const SYNC_MS = 2000;
const TRADE: Trade = "electrician";
/** The worker's card rate and floor, and the household's opening and budget, in paise: they overlap, so agents agree. */
const RATE_PAISE = 60_000;
const MIN_PAISE = 50_000;
const BUDGET_PAISE = 70_000;
const SEARCH_RADIUS_KM = 5;
const SERVICE_RADIUS_KM = 10;
/** A household asks this many of the workers it finds, as Find's "ask these" does. */
const ASK_WORKERS = 2;
/** For the listed-rates line Find shows: any kind of work queries the same way. */
const RATES_CATEGORY = "tv_repair";
const ANSWER = { problem: "Fan hums but does not spin" };

/** A worker agent's rules: the same work, rate and floor as the card it lists. */
export const workerRules = (base: Place): WorkerRules => ({
  trades: [TRADE],
  rate: { opening_paise: RATE_PAISE, limit_paise: MIN_PAISE },
  base,
  radius_km: SERVICE_RADIUS_KM,
});

export interface Journey {
  role: "worker" | "household";
  /** Milliseconds from start to the first signed job (households), when one was signed. */
  signedMs?: number;
  /** How far it got: the last stage passed. */
  stage: string;
  error?: string;
}

export interface Context {
  centre: Place;
  deadline: number;
  /** The model calls this person makes, spaced by `thinkMs` (a person reading and typing). */
  calls: readonly Call[];
  thinkMs: number;
  /** Workers this step listed: a household asks only these, never anyone else on the board. */
  workers: Set<UserId>;
}

/** A copy of `items` in random order (Fisher-Yates). */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const jitter = (ms: number) => ms * (0.5 + Math.random());

/** The person's model calls, one per turn of the chat, until they run out or the step ends. */
async function talkToModel(p: Phone, ctx: Context): Promise<void> {
  for (const call of ctx.calls) {
    if (performance.now() >= ctx.deadline) return;
    await sleep(jitter(ctx.thinkMs));
    await askModel(p, call).catch(() => undefined);
  }
}

/** Checks the mailbox every SYNC_MS until the step ends, letting `onTasks` act on what the agent asks. */
async function stayOpen(p: Phone, ctx: Context, onTasks?: () => Promise<void>): Promise<void> {
  while (performance.now() < ctx.deadline) {
    await p.device.sync().catch(() => undefined);
    await onTasks?.().catch(() => undefined);
    await sleep(SYNC_MS);
  }
}

export async function worker(p: Phone, ctx: Context): Promise<Journey> {
  const out: Journey = { role: "worker", stage: "signed in" };
  try {
    await p.api.boardSkills();
    const model = talkToModel(p, ctx);
    await publishCard(p, TRADE, ctx.centre, RATE_PAISE);
    ctx.workers.add(p.session.user);
    out.stage = "card listed";
    await Promise.all([model, stayOpen(p, ctx)]);
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
  }
  return out;
}

/** Answers what the agent asks the household: the workers' questions, then signing the deal. */
async function handleTasks(p: Phone): Promise<void> {
  for (const task of await p.device.tasks()) {
    if (task.kind === TaskKind.answerQuestions) await p.device.answer(task.engagement, ANSWER);
    if (task.kind === TaskKind.confirmDeal) await p.device.confirmDeal(task.engagement);
  }
}

async function signedJob(p: Phone, ids: readonly EngagementId[]): Promise<boolean> {
  for (const id of ids) if ((await p.device.job(id)).engagement.status === EngagementStatus.enum.agreed) return true;
  return false;
}

export async function household(p: Phone, ctx: Context, started: number): Promise<Journey> {
  const out: Journey = { role: "household", stage: "signed in" };
  try {
    await p.api.boardSkills();
    const model = talkToModel(p, ctx);
    await p.api.countFind("typed");
    await p.api.listedRates({ category: RATES_CATEGORY, ...ctx.centre });
    const found = await p.api.searchWorkers({ trade: TRADE, ...ctx.centre, radius_km: SEARCH_RADIUS_KM });
    // Every test card sits at the same spot, so the board lists them in one order: picking the first two would send
    // every household to the same two workers. Real households near different workers spread out; so do these.
    const ours = shuffled(found.filter((w) => ctx.workers.has(w.user))).slice(0, ASK_WORKERS);
    out.stage = `found ${ours.length}`;
    if (ours.length === 0) return out;
    const jobs = await p.device.request(
      {
        trade: TRADE,
        need: "Ceiling fan stopped working",
        when: "tomorrow 10:00",
        area: ctx.centre,
        details: {},
        budget: { opening_paise: MIN_PAISE, limit_paise: BUDGET_PAISE },
      },
      ours.map((w) => w.user),
    );
    out.stage = "asked";
    const ids = jobs.map((j) => j.engagement.id);
    await Promise.all([
      model,
      stayOpen(p, ctx, async () => {
        await handleTasks(p);
        if (out.signedMs === undefined && (await signedJob(p, ids))) {
          out.signedMs = Math.round(performance.now() - started);
          out.stage = "signed";
        }
      }),
    ]);
  } catch (err) {
    out.error = err instanceof Error ? err.message : String(err);
  }
  return out;
}
