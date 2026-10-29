import { Collection, type Storage } from "../ports.js";

/**
 * Whether the owner shares the price of a job both sides signed, anonymously, to improve rate estimates (ADR 0030 §3):
 * asked once per job, always, or never. One record in the owner's own settings, beside the answer-from-memory one, so
 * a second person signing in on the phone keeps their own choice. It never leaves the phone.
 */
export const SharePrices = { ask: "ask", always: "always", never: "never" } as const;
export type SharePrices = (typeof SharePrices)[keyof typeof SharePrices];

/** The choices in the order Settings shows them, the default first. */
export const SHARE_PRICES_OPTIONS: readonly SharePrices[] = [SharePrices.ask, SharePrices.always, SharePrices.never];

const SETTING_KEY = "share_prices";

/** Until the owner chooses, each signed job asks. */
export const DEFAULT_SHARE_PRICES: SharePrices = SharePrices.ask;

const isSharePrices = (value: unknown): value is SharePrices => SHARE_PRICES_OPTIONS.some((o) => o === value);

/** The owner's choice; a record that is not one of the choices counts as the default. */
export async function sharePrices(storage: Storage): Promise<SharePrices> {
  const value = await storage.get<unknown>(Collection.ownerSettings, SETTING_KEY);
  return isSharePrices(value) ? value : DEFAULT_SHARE_PRICES;
}

export async function setSharePrices(storage: Storage, mode: SharePrices): Promise<void> {
  if (!isSharePrices(mode)) throw new TypeError("unknown share setting");
  return storage.put(Collection.ownerSettings, SETTING_KEY, mode);
}
