import type { GigDevice, Ports, WorkerRules } from "@gigsync/core";
import type { GigView } from "../useGig.js";
import { ActivityFrame } from "./activity/ActivityFrame.js";

interface Props {
  ports: Ports;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens About me, where the UPI ID is added: a job's card asks for it before the customer pays. */
  onAddPayee: () => void;
  /** Opens the Money tab, where finished jobs are. */
  onRecords: () => void;
  /** The worker's card rules, so a request that fits can say the distance and hours it was checked by. */
  rules: WorkerRules | undefined;
}

/**
 * A worker's Jobs tab: the shared frame (Needs you, Agents talking, Agreed by day), each job a line that opens its
 * card with its own actions. The worker's nudges (the lowest price after a move, the UPI ID, mentors, bookings, the
 * card) are on Home, which is where a worker starts.
 */
export function Today({ ports, view, device, run, onAddPayee, onRecords, rules }: Props) {
  return (
    <ActivityFrame
      now={ports.clock.now()}
      byDay
      hint="activity.hint_worker"
      onRecords={onRecords}
      view={view}
      device={device}
      run={run}
      onAddPayee={onAddPayee}
      rules={rules}
    />
  );
}
