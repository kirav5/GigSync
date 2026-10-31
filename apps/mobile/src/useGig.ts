import {
  type GigDevice,
  type JobRecord,
  log,
  NetError,
  type OwnerTask,
  type Ports,
  type ReceivedOffer,
  restoredPayments,
} from "@gigsync/core";
import type { Payment } from "@gigsync/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { nameOf } from "./adapters/account.js";
import { syncPaused } from "./move/pause.js";

/** How often the phone checks its mailbox while the app is open. Push wake-ups replace this later (FCM). */
export const SYNC_MS = 2000;

/** Everything the job screens show, read from this phone after each sync. */
export interface GigView {
  jobs: JobRecord[];
  tasks: OwnerTask[];
  payments: Payment[];
  /** Offers to work from workers who scanned this household's QR, waiting for its answer. */
  offers: ReceivedOffer[];
  /** Display names the consumer saw on the board, by user id. */
  names: Record<string, string>;
  syncedAt?: Date;
}

const EMPTY: GigView = { jobs: [], tasks: [], payments: [], offers: [], names: {} };

/**
 * Keeps the job screens in step with the agent: syncs on a timer and after every owner action, one at a time, so an
 * action never races a sync over the same job. A slow phone must not pile up timer syncs, and a sync queued for a
 * replaced device (publishing a card makes a new one, with the worker's rules) must not run: the old device would
 * take a request it has no rules for and drop it. A sync the server did not answer (timed out, or no network) is
 * nothing to report: the next tick tries again, and every call has a deadline, so the queue never stays stuck.
 */
export function useGig(ports: Ports, device: GigDevice | undefined) {
  const [view, setView] = useState<GigView>(EMPTY);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const current = useRef(device);
  const timerQueued = useRef(false);

  const read = useCallback(async () => {
    if (!device) return;
    const [jobs, tasks, booked, offers] = await Promise.all([
      device.jobs(),
      device.tasks(),
      device.payments.all(),
      device.offers.open(),
    ]);
    const names = Object.fromEntries(
      await Promise.all(
        jobs.map(async (j) => [j.engagement.counterpart, (await nameOf(ports, j.engagement.counterpart)) ?? ""]),
      ),
    );
    // A job restored from the record carries its payments itself: they were never in this phone's payment book.
    const payments = [...booked, ...restoredPayments(jobs)];
    setView({ jobs, tasks, payments, offers, names, syncedAt: new Date() });
  }, [ports, device]);

  /** Runs `work` (an owner action, or nothing), then syncs and refreshes, after whatever is already running. */
  const run = useCallback(
    (work?: () => Promise<unknown>) => {
      const next = queue.current.then(async () => {
        if (!device || current.current !== device) return;
        let acted = false;
        try {
          if (work) await work();
          acted = true;
          // While a move to a new phone is on, the mailbox waits for the new phone.
          if (!syncPaused()) await device.sync();
        } catch (err) {
          // Done on the phone, but the server did not answer the sync: what is queued goes out on a later tick.
          if (acted && err instanceof NetError) return log.info("sync deferred: no answer", { reason: err.reason });
          log.warn("sync failed", { error: err instanceof Error ? err.message : String(err) });
          // The owner's action itself failed: their screen says so.
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
      void run()
        .catch(() => undefined)
        .finally(() => {
          timerQueued.current = false;
        });
    }, SYNC_MS);
    return () => clearInterval(timer);
  }, [device, run]);

  return { view, run };
}
