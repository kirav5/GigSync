import type { Page } from "@playwright/test";
import { jobsPrefix, userOf } from "./mentor-seed.js";

/** One finished job to seed: which household it was for (jobs with the same number are one household) and its stars. */
export interface SeededJob {
  household: number;
  stars?: number;
}

/**
 * Writes finished cooking jobs the signed-in worker did, both sides signed on the same terms and rated as given,
 * straight into the phone's storage: the record My card counts, without doing and rating jobs on screen. The server
 * saw none of them delivered, so the record it serves for this worker stays capped at nothing.
 */
export async function seedRatedJobs(page: Page, jobs: readonly SeededJob[]): Promise<void> {
  const me = await userOf(page);
  await page.evaluate(
    ({ jobs, me, prefix }) => {
      const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      const ULID_LENGTH = 26;
      const id = (p: string) =>
        `${p}_${Array.from({ length: ULID_LENGTH }, () => CROCKFORD[Math.floor(Math.random() * 32)]).join("")}`;
      const households = new Map<number, string>();
      const at = new Date().toISOString();
      for (const { household, stars } of jobs) {
        const customer = households.get(household) ?? id("usr");
        households.set(household, customer);
        const engagement = id("eng");
        const agree = {
          terms: {
            engagement,
            offer_id: id("off"),
            worker: me,
            consumer: customer,
            trade: "cook",
            scope: "Cooking",
            slot: "mornings",
            price_paise: 1_100_000,
          },
          terms_hash: "a".repeat(64),
          sig: "c2lnbmVk",
        };
        const job = {
          engagement: {
            id: engagement,
            group: engagement,
            role: "provider",
            counterpart: customer,
            status: "closed",
            brief: { text: "Cooking", topic: "cook", shared: {} },
            created_at: at,
            updated_at: at,
          },
          request: {
            trade: "cook",
            need: "Cooking",
            when: "mornings",
            area: { lat: 12.93, lon: 77.58 },
            details: {},
            lang: "en",
          },
          offers: [],
          offers_made: 0,
          asked: false,
          mine: agree,
          theirs: agree,
          ...(stars === undefined ? {} : { review: { stars, text: "" } }),
        };
        localStorage.setItem(`${prefix}${engagement}`, JSON.stringify(job));
      }
    },
    { jobs, me, prefix: jobsPrefix(me) },
  );
}
