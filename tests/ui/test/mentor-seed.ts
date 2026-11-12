import { Collection, ownedName } from "@gigsync/core";
import type { UserId } from "@gigsync/protocol";
import type { Page } from "@playwright/test";
import { signedIn, store } from "./phone-store.js";

/**
 * Writes `count` finished jobs the signed-in worker did, both sides signed on the same terms, the first begun `days`
 * ago, straight into the phone's storage: the record the mentor rule counts, without signing twenty jobs on screen.
 */
export async function seedRecord(page: Page, count: number, days: number): Promise<void> {
  const me = await userOf(page);
  await page.evaluate(
    async ({ count, days, me, jobs }) => {
      const writes: (Promise<void> | undefined)[] = [];
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
        writes.push(window.gigsyncStorage?.put(jobs, engagement, job));
      }
      await Promise.all(writes);
    },
    { count, days, me, jobs: ownedName(Collection.jobs, me) },
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

/** The signed-in owner's user id, from the account the phone keeps. */
export async function userOf(page: Page): Promise<UserId> {
  const user = await signedIn(page);
  if (!user) throw new Error("not signed in");
  return user;
}

/** A mentor link lasts this long. */
const LINK_DAYS = 30;
const MS_PER_DAY = 86_400_000;

/**
 * A live mentor link between two signed-in people, written into both phones' storage on one channel: the mentor on
 * the first, the newcomer on the second. That makes each someone the other knows, without the listing and request
 * that open one on screen.
 */
export async function seedMentorLink(first: Party, second: Party): Promise<void> {
  const [a, b] = await Promise.all([userOf(first.page), userOf(second.page)]);
  const channel = newId("eng");
  const now = Date.now();
  const write = (owner: Party, me: UserId, them: UserId, name: string, role: string) =>
    store(owner.page, ownedName(Collection.mentorLinks, me), them, {
      user: them,
      card: { name, trades: ["cook"], languages: ["en"] },
      channel,
      unread: 0,
      kind: "mentor",
      linked_at: new Date(now).toISOString(),
      expires_at: new Date(now + LINK_DAYS * MS_PER_DAY).toISOString(),
      mentor: { role },
    });
  await write(first, a, b, second.name, "newcomer");
  await write(second, b, a, first.name, "mentor");
}
