import type { Page } from "@playwright/test";

/** Where the web build keeps the phone's storage (Capacitor Preferences on the web), and the account's key there. */
const STORE_PREFIX = "CapacitorStorage.";
const ACCOUNT_KEY = `${STORE_PREFIX}settings:account`;
const JOBS_PREFIX = `${STORE_PREFIX}jobs:`;

/**
 * Writes `count` finished jobs the signed-in worker did, both sides signed on the same terms, the first begun `days`
 * ago, straight into the phone's storage: the record the mentor rule counts, without signing twenty jobs on screen.
 */
export async function seedRecord(page: Page, count: number, days: number): Promise<void> {
  await page.evaluate(
    ({ count, days, accountKey, jobsPrefix }) => {
      const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      const ULID_LENGTH = 26;
      const MS_PER_DAY = 86_400_000;
      const id = (prefix: string) =>
        `${prefix}_${Array.from({ length: ULID_LENGTH }, () => CROCKFORD[Math.floor(Math.random() * 32)]).join("")}`;
      const account = JSON.parse(localStorage.getItem(accountKey) ?? "{}") as { session?: { user?: string } };
      const me = account.session?.user;
      if (!me) throw new Error("not signed in");
      for (let i = 0; i < count; i++) {
        const engagement = id("eng");
        const customer = id("usr");
        const at = new Date(Date.now() - (days - i) * MS_PER_DAY).toISOString();
        const agree = {
          terms: {
            engagement,
            offer_id: id("off"),
            worker: me,
            consumer: customer,
            trade: "cook",
            scope: "Cooking",
            slot: "mornings",
            price_paise: 900_000,
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
            area: { lat: 12.93, lon: 77.62 },
            details: {},
            lang: "en",
          },
          offers: [],
          offers_made: 0,
          asked: false,
          mine: agree,
          theirs: agree,
        };
        localStorage.setItem(`${jobsPrefix}${engagement}`, JSON.stringify(job));
      }
    },
    { count, days, accountKey: ACCOUNT_KEY, jobsPrefix: JOBS_PREFIX },
  );
}
