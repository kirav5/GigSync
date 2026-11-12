import { Collection } from "@gigsync/core";
import { UserId } from "@gigsync/protocol";
import type { Page } from "@playwright/test";

/**
 * The phone's storage, as the tests reach it. The web build seals every record in IndexedDB (ADR 0065), so a test can
 * no longer read or write one through localStorage; the app's dev build puts its storage on `window.gigsyncStorage`
 * (apps/mobile/src/adapters/store/open.ts) and these go through it, so a seeded record is one the running app sees.
 *
 * A record written to localStorage under `CapacitorStorage.<collection>:<id>` before the app's first start is still
 * taken in, as an old phone's records are; some specs set a phone up that way from an init script.
 */
declare global {
  interface Window {
    gigsyncStorage?: {
      get(collection: string, id: string): Promise<unknown>;
      put(collection: string, id: string, value: unknown): Promise<void>;
      settled(): Promise<void>;
    };
  }
}

export const stored = (page: Page, collection: string, id: string): Promise<unknown> =>
  page.evaluate(([c, i]) => window.gigsyncStorage?.get(c, i), [collection, id] as const);

export const store = (page: Page, collection: string, id: string, value: unknown): Promise<void> =>
  page.evaluate(([c, i, v]) => window.gigsyncStorage?.put(c, i, v), [collection, id, value] as const);

/**
 * Waits until the app has kept everything it was writing. A write is sealed before it is kept, which takes a moment
 * the screen does not wait for: a page reloaded right after a tap can lose that tap's record.
 */
export const saved = (page: Page): Promise<void> => page.evaluate(() => window.gigsyncStorage?.settled());

const ACCOUNT_ID = "account";

/** The signed-in owner's user id from the account the phone keeps, if anyone is signed in. */
export async function signedIn(page: Page): Promise<UserId | undefined> {
  const account = (await stored(page, Collection.settings, ACCOUNT_ID)) as { session?: { user?: string } } | undefined;
  const parsed = UserId.safeParse(account?.session?.user);
  return parsed.success ? parsed.data : undefined;
}
