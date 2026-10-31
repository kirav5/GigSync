import { Collection, ownedName } from "@gigsync/core";
import { UserId } from "@gigsync/protocol";
import type { Page } from "@playwright/test";

/** Where the web build keeps the phone's storage (Capacitor Preferences on the web), and the account's key there. */
const STORE_PREFIX = "CapacitorStorage.";
const ACCOUNT_KEY = `${STORE_PREFIX}settings:account`;

/** Where the web build keeps one owner's jobs: their own collection, as the app's owner storage names it. */
export const jobsPrefix = (user: UserId) => `${STORE_PREFIX}${ownedName(Collection.jobs, user)}:`;

/**
 * Writes `count` finished jobs the signed-in worker did, both sides signed on the same terms, the first begun `days`
 * ago, straight into the phone's storage: the record the mentor rule counts, without signing twenty jobs on screen.
 */
export async function seedRecord(page: Page, count: number, days: number): Promise<void> {
  const me = await userOf(page);
  await page.evaluate(
    ({ count, days, me, jobsPrefix }) => {
      const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      const ULID_LENGTH = 26;
      const MS_PER_DAY = 86_400_000;
      const id = (prefix: string) =>
        `${prefix}_${Array.from({ length: ULID_LENGTH }, () => CROCKFORD[Math.floor(Math.random() * 32)]).join("")}`;
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
    { count, days, me, jobsPrefix: jobsPrefix(me) },
  );
}

/** One side of a seeded job: the signed-in page, and the name and number its owner signed in with. */
export interface Party {
  page: Page;
  name: string;
  phone: string;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_LENGTH = 26;
const newId = (prefix: string) =>
  `${prefix}_${Array.from({ length: ULID_LENGTH }, () => CROCKFORD[Math.floor(Math.random() * CROCKFORD.length)]).join("")}`;

/** The signed-in owner's user id, from the account the web build keeps. */
export async function userOf(page: Page): Promise<UserId> {
  const user = await page.evaluate((key) => {
    const account = JSON.parse(localStorage.getItem(key) ?? "{}") as { session?: { user?: string } };
    return account.session?.user;
  }, ACCOUNT_KEY);
  const parsed = UserId.safeParse(user);
  if (!parsed.success) throw new Error("not signed in");
  return parsed.data;
}

/**
 * A finished cooking job between a household and a worker, written into both phones' storage on one engagement id:
 * both signed the same terms and each holds the other's contact card, as after a real job. That makes each someone
 * the other knows, without doing the job on screen.
 */
export async function seedSignedJob(household: Party, worker: Party): Promise<void> {
  const [consumer, me] = await Promise.all([userOf(household.page), userOf(worker.page)]);
  const engagement = newId("eng");
  const at = new Date().toISOString();
  const agree = {
    terms: {
      engagement,
      offer_id: newId("off"),
      worker: me,
      consumer,
      trade: "cook",
      scope: "Cooking",
      slot: "mornings",
      price_paise: 900_000,
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  const job = (role: string, counterpart: string, other: Party) => ({
    engagement: {
      id: engagement,
      group: engagement,
      role,
      counterpart,
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
    contact: { name: other.name, phone: other.phone },
  });
  const write = (page: Page, owner: UserId, record: object) =>
    page.evaluate(({ key, json }) => localStorage.setItem(key, json), {
      key: `${jobsPrefix(owner)}${engagement}`,
      json: JSON.stringify(record),
    });
  await write(household.page, consumer, job("requester", me, worker));
  await write(worker.page, me, job("provider", consumer, household));
}
