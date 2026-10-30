import { keepPublishedRecord, log, type Ports, recordDue } from "@gigsync/core";
import { useEffect, useRef } from "react";
import { type Account, AccountRole, apiClient } from "../adapters/account.js";
import type { GigView } from "../useGig.js";
import { publicCard } from "./publish.js";

/** After the board did not take the record, wait this long before trying again (ms), not every sync. */
const RETRY_MS = 60_000;

/**
 * Keeps the record on a worker's board card current (ADR 0036): after each sync, when a new job both signed was
 * finished, a review arrived, or the owner changed "Show my record on my card" in Privacy, the card is published
 * again with the record. Nothing is sent while the card is off the board, or before the first read of this phone's
 * jobs (an empty list then would publish zeros over the real record).
 */
export function useRecordPublish(ports: Ports, account: Account, view: GigView): void {
  const sending = useRef(false);
  const retryAt = useRef(0);

  useEffect(() => {
    const card = account.role === AccountRole.worker ? publicCard(account) : undefined;
    if (!card || !view.syncedAt || sending.current || Date.now() < retryAt.current) return;
    sending.current = true;
    const publish = async () => {
      const record = await recordDue(ports.storage, view.jobs);
      if (!record) return;
      await apiClient(account.session).publishProfile({ ...card, ...record });
      await keepPublishedRecord(ports.storage, record);
      log.info("card record published", { shown: record.show_record });
    };
    publish()
      .catch((err: unknown) => {
        retryAt.current = Date.now() + RETRY_MS;
        log.warn("card record not published", { error: err instanceof Error ? err.message : String(err) });
      })
      .finally(() => {
        sending.current = false;
      });
  }, [ports, account, view]);
}
