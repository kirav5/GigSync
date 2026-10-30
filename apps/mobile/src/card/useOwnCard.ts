import { cachedOwnCard, log, type OwnCard, type Ports, refreshOwnCard } from "@gigsync/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Account, AccountRole } from "../adapters/account.js";
import { recordsClient } from "../adapters/records.js";

/** Least time between two reads of the served card on syncs (ms): syncs come every two seconds. */
const REFRESH_MS = 30_000;

/**
 * A worker's own card as GigSync serves it to them, with the record it keeps and their "Show my record" switch
 * (ADR 0038 §3): what this phone last read first, for an instant paint, then read again on opening and after syncs.
 * Undefined until the first is known; null when the worker has no card on the board.
 */
export function useOwnCard(
  ports: Ports,
  account: Account,
  syncedAt?: Date,
): { card: OwnCard | undefined; keep: (card: OwnCard) => void } {
  const [card, setCard] = useState<OwnCard>();
  const readAt = useRef(0);
  const isWorker = account.role === AccountRole.worker;

  const refresh = useCallback(() => {
    readAt.current = Date.now();
    refreshOwnCard(recordsClient(account.session), ports.storage)
      .then(setCard)
      .catch((err: unknown) => log.info("own card not read", { error: err instanceof Error ? err.name : String(err) }));
  }, [ports, account.session]);

  useEffect(() => {
    if (!isWorker) return;
    cachedOwnCard(ports.storage)
      // The server's answer may have come first: it wins.
      .then((cached) => cached !== undefined && setCard((now) => (now === undefined ? cached : now)))
      .catch((err: unknown) => log.warn("own card cache unread", { error: String(err) }));
    refresh();
  }, [ports, isWorker, refresh]);

  useEffect(() => {
    if (isWorker && syncedAt && Date.now() - readAt.current >= REFRESH_MS) refresh();
  }, [isWorker, syncedAt, refresh]);

  return { card, keep: setCard };
}
