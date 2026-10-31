import { HttpError, NetError } from "@gigsync/core";
import type { AreaKey, EngagementId, Estimate, EstimateRequest, JobTerms, OfferId } from "@gigsync/protocol";
import { isEstimate, Role } from "@gigsync/protocol";
import { newPhone } from "./helpers.js";
import { id, person, submit } from "./record-seed.js";

/**
 * Market prices through the real API (ADR 0039 §1): cooking jobs (3–4 people, two meals, the default cook bucket)
 * agreed in one pilot area, kept by GigSync as two real phones would leave them (both sides submit with their
 * signatures, then done), so estimates for that area come from them. Cooking because the shared database already holds
 * many cooking jobs from the record seeds: seeding more changes no other spec's range.
 */

/** The cook bucket the seeds and the card's default scope share. */
export const COOK_REQUEST = { city: "bengaluru", trade: "cook", scope: { people: "3_4", meals: "2" } } as const;

/** A 503 while the local API reloads after a file change, or no answer while it restarts: worth asking again. */
const RELOADING = 503;
/** Up to half a minute in all, as long as the API takes to start again. */
const RETRIES = 10;
const RETRY_MS = 3000;

const passing = (err: unknown) => (err instanceof HttpError && err.status === RELOADING) || err instanceof NetError;

/** Runs one API call, again while the API is reloading; each call here is safe to repeat. */
async function steady<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (!passing(err) || attempt >= RETRIES) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }
}

/** Stores `count` attested, done cooking jobs at `price_paise` in `area`, each between two new people. */
export async function seedAreaJobs(area: AreaKey, count: number, price_paise: number): Promise<void> {
  // Each job between a worker and a household of its own: a range needs that many different people (ADR 0039 §1).
  for (let i = 0; i < count; i++) {
    const [worker, home] = await Promise.all([person(newPhone()), person(newPhone())]);
    const engagement = id("eng") as EngagementId;
    const terms: JobTerms = {
      engagement,
      offer_id: id("off") as OfferId,
      worker: worker.user,
      consumer: home.user,
      trade: COOK_REQUEST.trade,
      scope: "Cooking",
      slot: "mornings",
      price_paise,
    };
    const mine = await submit(worker, home, Role.enum.provider, terms, area);
    const theirs = await submit(home, worker, Role.enum.requester, terms, area);
    await steady(() => worker.api.submitJob(mine));
    await steady(() => home.api.submitJob(theirs));
    await steady(() => worker.api.reportStatus(engagement, { status: "done" }));
  }
}

/** The estimate the API gives now for a request, asked as a signed-in phone would; undefined for "no estimate". */
export async function estimateNow(request: EstimateRequest): Promise<Estimate | undefined> {
  const asker = await person(newPhone());
  const answer = await steady(() => asker.api.estimate(request));
  return isEstimate(answer) ? answer : undefined;
}
