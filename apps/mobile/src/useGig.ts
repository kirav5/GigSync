import {
  type GigDevice,
  type JobRecord,
  log,
  NetError,
  nextSyncDelay,
  type OwnerTask,
  type Ports,
  type ReceivedOffer,
  restoredPayments,
  SYNC_FAST_MS,
  SYNC_SLOW_MS,
  talksMoving,
} from "@gigsync/core";
import type { Payment } from "@gigsync/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { nameOf } from "./adapters/account.js";
import { awake, onWake } from "./adapters/awake.js";
import { offerAlerts } from "./adapters/push.js";
import { syncPaused } from "./move/pause.js";

/**
 * `syncedAt` moves at least this often while the app is awake, even when nothing changed (ms): the screens say when
 * the phone last checked, and some read their own data again when it moves (the worker's card, mentor links).
 */
const SYNCED_AT_EVERY_MS = SYNC_SLOW_MS;

/** Everything the job screens show, read from this phone after each sync. */
export interface GigView {
  jobs: JobRecord[];
  tasks: OwnerTask[];
  payments: Payment[];
  /** Offers to work from workers who scanned this household's QR, waiting for its answer. */
  offers: ReceivedOffer[];
  /** Display names the consumer saw on the board, by user id. */
  names: Record<string, string>;
  /** When the phone last checked and something moved or changed, or `SYNCED_AT_EVERY_MS` had passed since. */
  syncedAt?: Date;
}

const EMPTY: GigView = { jobs: [], tasks: [], payments: [], offers: [], names: {} };
/** Nothing shown yet: the first read always sets the view. */
const UNSHOWN = { key: "", at: 0 };
/** What the next wait is decided from (`nextSyncDelay`), kept between syncs. */
interface Pace {
  delayMs: number;
  moved: boolean;
  talking: boolean;
  /** When the owner last did something here (ms). */
  actedAt?: number;
}
const QUIET: Pace = { delayMs: SYNC_FAST_MS, moved: false, talking: false };
const nothing = () => undefined;

/**
 * Keeps the job screens in step with the agent: syncs on a timer and after every owner action, one at a time, so an
 * action never races a sync over the same job. The timer is set again after each sync: two seconds while something is
 * moving, stepping out to thirty when nothing is (`nextSyncDelay`), and not at all while the app is off screen or
 * offline; coming back checks at once. A slow phone must not pile up timer syncs, and a sync queued for a
 * replaced device (publishing a card makes a new one, with the worker's rules) must not run: the old device would
 * take a request it has no rules for and drop it. A sync the server did not answer (timed out, or no network) is
 * nothing to report: the next tick tries again, and every call has a deadline, so the queue never stays stuck.
 */
export function useGig(ports: Ports, device: GigDevice | undefined) {
  const [view, setView] = useState<GigView>(EMPTY);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const current = useRef(device);
  const timerQueued = useRef(false);
  const shown = useRef(UNSHOWN);
  const pace = useRef<Pace>({ ...QUIET });
  /** Sets the timer for the next check once a sync has ended; the effect below owns the timer. */
  const rearm = useRef<() => void>(nothing);

  /** Reads what the screens show; sets it only when it differs, a message `moved`, or the last time is old. */
  const read = useCallback(
    async (moved: boolean) => {
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
      const next = { jobs, tasks, payments: [...booked, ...restoredPayments(jobs)], offers, names };
      const now = new Date();
      pace.current.talking = talksMoving(jobs, now);
      // A sync that changed nothing must not draw every job screen again: the same words are the same view.
      const key = JSON.stringify(next);
      const changed = key !== shown.current.key;
      if (!changed && !moved && now.getTime() - shown.current.at < SYNCED_AT_EVERY_MS) return;
      shown.current = { key, at: now.getTime() };
      setView((was) => ({ ...(changed ? next : was), syncedAt: now }));
    },
    [ports, device],
  );

  /** Runs `work` (an owner action, or nothing), then syncs and refreshes, after whatever is already running. */
  const run = useCallback(
    (work?: () => Promise<unknown>) => {
      // An owner's own action (a tap) is when the browser may ask about notifications, once.
      if (work) void offerAlerts();
      if (work) pace.current.actedAt = Date.now();
      const next = queue.current.then(async () => {
        if (!device || current.current !== device) return;
        let acted = false;
        // The owner's own action always reads again: what it changed may not be in the view (a mentor's note).
        let moved = !!work;
        try {
          if (work) await work();
          acted = true;
          // While a move to a new phone is on, the mailbox waits for the new phone.
          if (!syncPaused()) {
            const { received, sent } = await device.sync();
            if (received + sent > 0) moved = true;
            pace.current.moved ||= received + sent > 0;
          }
        } catch (err) {
          // Done on the phone, but the server did not answer the sync: what is queued goes out on a later tick.
          if (acted && err instanceof NetError) return log.info("sync deferred: no answer", { reason: err.reason });
          log.warn("sync failed", { error: err instanceof Error ? err.message : String(err) });
          // The owner's action itself failed: their screen says so.
          if (work) throw err;
        } finally {
          // Whatever the read does, the next check is set: a failed read must not end the checking.
          await read(moved).finally(() => rearm.current());
        }
      });
      queue.current = next.catch(() => undefined);
      return next;
    },
    [device, read],
  );

  useEffect(() => {
    current.current = device;
    shown.current = UNSHOWN;
    pace.current = { ...QUIET };
    setView(EMPTY);
    if (!device) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      // Asleep: no check and no timer; waking starts both again.
      if (!awake() || timerQueued.current) return;
      timerQueued.current = true;
      void run()
        .catch(nothing)
        .finally(() => {
          timerQueued.current = false;
        });
    };
    rearm.current = () => {
      clearTimeout(timer);
      const { delayMs, moved, talking, actedAt } = pace.current;
      const sinceActionMs = actedAt === undefined ? undefined : Date.now() - actedAt;
      const next = nextSyncDelay({ previousMs: delayMs, moved, talking, sinceActionMs });
      pace.current = { ...pace.current, delayMs: next, moved: false };
      if (awake()) timer = setTimeout(check, next);
    };
    void run();
    const stopWatching = onWake(() => {
      clearTimeout(timer);
      pace.current.delayMs = SYNC_FAST_MS;
      check();
    });
    return () => {
      clearTimeout(timer);
      rearm.current = nothing;
      stopWatching();
    };
  }, [device, run]);

  return { view, run };
}
