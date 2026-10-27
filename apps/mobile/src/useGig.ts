import { Collection, type GigDevice, type JobRecord, log, type OwnerTask, type Ports } from "@gigsync/core";
import type { Payment, PaymentRequest } from "@gigsync/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { nameOf } from "./adapters/account.js";

/** How often the phone checks its mailbox while the app is open. Push wake-ups replace this later (FCM). */
export const SYNC_MS = 2000;

/** Everything the job screens show, read from this phone after each sync. */
export interface GigView {
  jobs: JobRecord[];
  tasks: OwnerTask[];
  payments: Payment[];
  /** Payment requests received (consumer), with the worker's UPI ID, by payment id. */
  requests: Record<string, PaymentRequest>;
  /** Display names the consumer saw on the board, by user id. */
  names: Record<string, string>;
  syncedAt?: Date;
}

const EMPTY: GigView = { jobs: [], tasks: [], payments: [], requests: {}, names: {} };

/**
 * Keeps the job screens in step with the agent: syncs on a timer and after every owner action, one at a time, so an
 * action never races a sync over the same job.
 */
export function useGig(ports: Ports, device: GigDevice | undefined) {
  const [view, setView] = useState<GigView>(EMPTY);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const read = useCallback(async () => {
    if (!device) return;
    const [jobs, tasks, payments, requests] = await Promise.all([
      device.jobs(),
      device.tasks(),
      device.payments.all(),
      ports.storage.list<PaymentRequest>(Collection.paymentRequests),
    ]);
    const names = Object.fromEntries(
      await Promise.all(
        jobs.map(async (j) => [j.engagement.counterpart, (await nameOf(ports, j.engagement.counterpart)) ?? ""]),
      ),
    );
    setView({
      jobs,
      tasks,
      payments,
      requests: Object.fromEntries(requests.map((r) => [r.id, r])),
      names,
      syncedAt: new Date(),
    });
  }, [ports, device]);

  /** Runs `work` (an owner action, or nothing), then syncs and refreshes, after whatever is already running. */
  const run = useCallback(
    (work?: () => Promise<unknown>) => {
      const next = queue.current.then(async () => {
        if (!device) return;
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
    setView(EMPTY);
    if (!device) return;
    void run();
    const timer = setInterval(() => void run(), SYNC_MS);
    return () => clearInterval(timer);
  }, [device, run]);

  return { view, run };
}
