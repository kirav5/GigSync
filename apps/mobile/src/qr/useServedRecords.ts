import { type GigDevice, log } from "@gigsync/core";
import type { UserId, WorkerRecord } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";

/** Joins the workers' ids into one dependency, so a sync that read the same offers again asks nothing. */
const ID_SEPARATOR = ",";

/**
 * The records the board serves (capped by the server) for the workers whose offers to work this household sees, read
 * once per set of offers: an offer's own card arrived sealed, so its record could not be capped and is never shown.
 */
export function useServedRecords(device: GigDevice, workers: readonly UserId[]): ReadonlyMap<UserId, WorkerRecord> {
  const [records, setRecords] = useState<ReadonlyMap<UserId, WorkerRecord>>(new Map());
  const latest = useRef(workers);
  latest.current = workers;
  const ids = workers.join(ID_SEPARATOR);

  useEffect(() => {
    if (!ids) return;
    let live = true;
    const read = async (user: UserId) => [user, await device.offers.servedRecord(user)] as const;
    Promise.all(latest.current.map(read))
      .then((found) => {
        const shown = found.flatMap(([user, record]) => (record ? [[user, record] as const] : []));
        if (live) setRecords(new Map(shown));
      })
      .catch((err: unknown) =>
        log.warn("served records not read", { error: err instanceof Error ? err.name : String(err) }),
      );
    return () => {
      live = false;
    };
  }, [device, ids]);

  return records;
}
