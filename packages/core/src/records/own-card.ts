import type { MyBoardProfile } from "@gigsync/protocol";
import { Collection, type Storage } from "../ports.js";
import type { RecordsApi } from "./types.js";

/**
 * The worker's own card as GigSync serves it to them, with the record it computed from the jobs both phones attested
 * and their "Show my record" switch (ADR 0038 §3). Kept on the phone so My card paints at once; read after each sync.
 */

/** What the phone keeps: the served card, or null when the worker has no card on the board. */
export type OwnCard = MyBoardProfile | null;

const OWN_CARD_KEY = "own_card";

/** The card as last read; undefined before the first read on this phone. */
export function cachedOwnCard(storage: Storage): Promise<OwnCard | undefined> {
  return storage.get<OwnCard>(Collection.ownerSettings, OWN_CARD_KEY);
}

export function keepOwnCard(storage: Storage, card: OwnCard): Promise<void> {
  return storage.put<OwnCard>(Collection.ownerSettings, OWN_CARD_KEY, card);
}

/** Reads the served card and keeps it; a failure leaves the kept one and goes to the caller. */
export async function refreshOwnCard(api: Pick<RecordsApi, "ownCard">, storage: Storage): Promise<OwnCard> {
  const card = (await api.ownCard()) ?? null;
  await keepOwnCard(storage, card);
  return card;
}
