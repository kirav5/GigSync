import type { GigDevice, JobRecord } from "@gigsync/core";
import type { GigView } from "../useGig.js";

interface Props {
  job: JobRecord;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens Profile when the worker has no UPI ID yet. */
  onAddPayee: () => void;
}

/** The worker's money actions inside a signed job: ask to be paid, show the QR, cash, received or not. */
export function WorkerPay(_props: Props) {
  return null;
}
