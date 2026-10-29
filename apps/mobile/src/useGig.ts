import { type GigDevice, type JobRecord, log, type OwnerTask, type Ports } from "@gigsync/core";
import type { Payment } from "@gigsync/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { nameOf } from "./adapters/account.js";

/** How often the phone checks its mailbox while the app is open. Push wake-ups replace this later (FCM). */
export const SYNC_MS = 2000;

/** Everything the job screens show, read from this phone after each sync. */
export interface GigView {
  jobs: JobRecord[];
  tasks: OwnerTask[];
  payments: Payment[];
  /** Display names the consumer saw on the board, by user id. */
  names: Record<string, string>;
  syncedAt?: Date;
}

const EMPTY: GigView = { jobs: [], tasks: [], payments: [], names: {} };

/**
 * Keeps the job screens in step with the agent: syncs on a timer and after every owner action, one at a time, so an
 * action never races a sync over the same job. A slow phone must not pile up timer syncs, and a sync queued for a
 * replaced device (publishing a card makes a new one, with the worker's rules) must not run: the old device would
 * take a request it has no rules for and drop it.
 */
export function useGig(ports: Ports, device: GigDevice | undefined) {
  const [view, setView] = useState<GigView>(EMPTY);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const current = useRef(device);
  const timerQueued = useRef(false);

  const read = useCallback(async () => {
    if (!device) return;
    const [jobs, tasks, payments] = await Promise.all([device.jobs(), device.tasks(), device.payments.all()]);
    const names = Object.fromEntries(
      await Promise.all(
        jobs.map(async (j) => [j.engagement.counterpart, (await nameOf(ports, j.engagement.counterpart)) ?? ""]),
      ),
    );
    setView({ jobs, tasks, payments, names, syncedAt: new Date() });
  }, [ports, device]);

  /** Runs `work` (an owner action, or nothing), then syncs and refreshes, after whatever is already running. */
  const run = useCallback(
    (work?: () => Promise<unknown>) => {
      const next = queue.current.then(async () => {
        if (!device || current.current !== device) return;
        try {
          if (work) await work();
          await device.sync();
        } catch (err) {
          log.warn("sync failed", { error: err instanceof Error ? err.message : String(err) });
          if (work) throw err;
        } finally {
          await read();
        }
      });
      queue.current = next.catch(() => undefined);
      return next;
    },
    [device, read],
  );

  useEffect(() => {
    current.current = device;
    setView(EMPTY);
    if (!device) return;
    void run();
    const timer = setInterval(() => {
      if (timerQueued.current) return;
      timerQueued.current = true;
      void run().finally(() => {
        timerQueued.current = false;
      });
    }, SYNC_MS);
    return () => clearInterval(timer);
  }, [device, run]);

  return { view, run };
}
