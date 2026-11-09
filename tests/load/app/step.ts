import type { Place, UserId } from "@gigsync/protocol";
import { type Call, type Corpus, sideCalls } from "../model/corpus.js";
import { household, type Journey, worker, workerRules } from "./journeys.js";
import { type Hit, meteredFetch } from "./meter.js";
import { type Phone, signIn } from "./people.js";

/**
 * One step: `users` people at once, a share of them workers. Workers arrive over the first `rampS` seconds and list
 * their cards; households arrive over the next `rampS` and ask them. Everyone stays open until the step ends, then
 * takes their card down and signs out, so nothing of the test stays on the board.
 */

export interface StepOptions {
  base: string;
  code: string;
  users: number;
  seconds: number;
  rampS: number;
  workerShare: number;
  thinkMs: number;
  /** The run's model calls, or none to leave the model out. */
  corpus?: Corpus;
}

export interface StepResult {
  hits: Hit[];
  journeys: Journey[];
  signInFailures: number;
}

const MS_PER_S = 1000;
/**
 * In the Bay of Bengal, nowhere near a pilot area: no real worker is ever within reach of a test household, and the
 * households ask only the step's own workers anyway.
 */
const SEA: Place = { lat: 14.5, lon: 87.5 };
const SPREAD_DEGREES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** `n` calls drawn from one side's calls in the run: that person's share of the model's work. */
function callsFor(corpus: Corpus | undefined, side: string): Call[] {
  if (!corpus) return [];
  const all = sideCalls(corpus, side);
  const perJourney = Math.round(all.length / Math.max(1, corpus.kinds));
  return Array.from({ length: perJourney }, () => all[Math.floor(Math.random() * all.length)] as Call);
}

export async function runStep(o: StepOptions): Promise<StepResult> {
  const stepStart = performance.now();
  const deadline = stepStart + o.seconds * MS_PER_S;
  const centre = { lat: SEA.lat + Math.random() * SPREAD_DEGREES, lon: SEA.lon + Math.random() * SPREAD_DEGREES };
  const rules = workerRules(centre);
  const hits: Hit[] = [];
  const workers = new Set<UserId>();
  const phones: { phone: Phone; isWorker: boolean }[] = [];
  let signInFailures = 0;
  const workerCount = Math.max(1, Math.round(o.users * o.workerShare));
  const arrive = async (i: number): Promise<Journey | undefined> => {
    const isWorker = i < workerCount;
    const slot = isWorker ? i / workerCount : 1 + (i - workerCount) / Math.max(1, o.users - workerCount);
    await sleep(slot * o.rampS * MS_PER_S);
    let phone: Phone;
    try {
      phone = await signIn(
        o.base,
        o.code,
        meteredFetch(hits, () => stepStart),
        isWorker ? rules : undefined,
      );
    } catch {
      signInFailures += 1;
      return undefined;
    }
    phones.push({ phone, isWorker });
    const ctx = {
      centre,
      deadline,
      calls: callsFor(o.corpus, isWorker ? "worker" : "customer"),
      thinkMs: o.thinkMs,
      workers,
    };
    return isWorker ? worker(phone, ctx) : household(phone, ctx, performance.now());
  };
  const journeys = (await Promise.all(Array.from({ length: o.users }, (_, i) => arrive(i)))).filter(
    (j): j is Journey => j !== undefined,
  );
  await Promise.all(
    phones.map(async ({ phone, isWorker }) => {
      if (isWorker) await phone.api.removeProfile().catch(() => undefined);
      await phone.api.signOut().catch(() => undefined);
    }),
  );
  return { hits, journeys, signInFailures };
}
