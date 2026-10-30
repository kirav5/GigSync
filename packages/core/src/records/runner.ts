import type { Payment } from "@gigsync/protocol";
import type { JobRecord } from "../job/store.js";
import type { Clock, Storage } from "../ports.js";
import { sendRecords } from "./send.js";
import type { RecordsApi } from "./types.js";

/** What the runner reads each time: the owner's jobs and payments as they are now. */
export interface RecordsSource {
  jobs(): Promise<JobRecord[]>;
  payments(): Promise<Payment[]>;
}

/** After a run left facts to try later, syncs wait this long before trying again, doubling up to the cap (ms). */
export const RECORDS_RETRY_MS = 30_000;
export const RECORDS_RETRY_MAX_MS = 15 * 60_000;

/**
 * Sends a phone's pending job records one run at a time: a run asked for while one is going waits for it, so the same
 * fact is never in flight twice and a fact that appeared meanwhile still goes. Syncs come every few seconds, so after
 * a run the server could not finish (offline, or a job the other phone has not sent yet) they wait, longer each time;
 * the owner signing, paying or rating sends at once.
 */
export class RecordsRunner {
  private queue: Promise<unknown> = Promise.resolve();
  private wait = 0;
  private retryAt = 0;

  constructor(
    private readonly api: RecordsApi,
    private readonly storage: Storage,
    private readonly clock: Clock,
    private readonly source: RecordsSource,
  ) {}

  /** `now`: the owner just acted, so any wait is skipped. Resolves to how many facts the server took. */
  run(now = false): Promise<number> {
    const next = this.queue.then(async () => {
      if (!now && this.clock.now().getTime() < this.retryAt) return 0;
      const [jobs, payments] = await Promise.all([this.source.jobs(), this.source.payments()]);
      const { taken, later } = await sendRecords({ api: this.api, storage: this.storage }, jobs, payments);
      this.wait = later ? Math.min(Math.max(this.wait * 2, RECORDS_RETRY_MS), RECORDS_RETRY_MAX_MS) : 0;
      this.retryAt = this.clock.now().getTime() + this.wait;
      return taken;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** The owner just signed, paid or rated: their record goes now rather than at the next sync. Never throws. */
  soon(): void {
    this.run(true).catch(() => undefined);
  }
}
