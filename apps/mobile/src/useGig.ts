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
import { onPushArrived } from "./adapters/nativePush.js";
import { offerAlerts } from "./adapters/push.js";
import { syncPaused } from "./move/pause.js";

/** How often the phone checks its mailbox while something is moving: just after an action, or a message in or out. */
export const SYNC_MS = 2000;
/** How often it checks while nothing has moved for a while; coming back to the app checks at once. */
export const IDLE_SYNC_MS = 15_000;
/** How long after the last action or message the phone keeps checking every SYNC_MS. */
const BUSY_FOR_MS = 60_000;

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
 * action never races a sync over the same job. The timer is quick only while something is moving (an action, or a
 * message in or out, in the last minute), slow otherwise, and stops while the app is in the background; coming back,
 * or an alert arriving (ADR 0067), checks at once. A slow phone must not pile up timer syncs, and a sync queued for a
 * replaced device (publishing a card makes a new one, with the worker's rules) must not run: the old device would
 * take a request it has no rules for and drop it. A sync the server did not answer (timed out, or no network) is
 * nothing to report: the next tick tries again, and every call has a deadline, so the queue never stays stuck.
 */
export function useGig(ports: Ports, device: GigDevice | undefined) {
  const [view, setView] = useState<GigView>(EMPTY);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const current = useRef(device);
  const timerQueued = useRef(false);
  /** When something last moved: an owner action, or a sync that carried a message either way. */
  const movedAt = useRef(Date.now());

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
      // An owner's own action (a tap) is when the browser may ask about notifications, once.
      if (work) void offerAlerts();
      const next = queue.current.then(async () => {
        if (!device || current.current !== device) return;
        let acted = false;
        try {
          if (work) {
            movedAt.current = Date.now();
            await work();
          }
          acted = true;
          // While a move to a new phone is on, the mailbox waits for the new phone.
          if (!syncPaused()) {
            const { received, sent } = await device.sync();
            if (received + sent > 0) movedAt.current = Date.now();
          }
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (timerQueued.current) return;
      timerQueued.current = true;
      void run()
        .catch(() => undefined)
        .finally(() => {
          timerQueued.current = false;
        });
    };
    const schedule = () => {
      clearTimeout(timer);
      if (document.hidden) return;
      const busy = Date.now() - movedAt.current < BUSY_FOR_MS;
      timer = setTimeout(
        () => {
          tick();
          schedule();
        },
        busy ? SYNC_MS : IDLE_SYNC_MS,
      );
    };
    const shown = () => {
      if (document.hidden) return clearTimeout(timer);
      tick();
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", shown);
    // An alert says something came: look now, and keep looking quickly for a minute.
    const offPush = onPushArrived(() => {
      movedAt.current = Date.now();
      shown();
    });
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", shown);
      offPush();
    };
  }, [device, run]);

  return { view, run };
}
