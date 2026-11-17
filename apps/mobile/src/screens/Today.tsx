import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../adapters/account.js";
import type { GigView } from "../useGig.js";
import { ActivityFrame } from "./activity/ActivityFrame.js";
import { type NudgeMoves, WorkerNudges } from "./activity/WorkerNudges.js";

interface Props extends NudgeMoves {
  ports: Ports;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  account: Account;
  /** Opens the Money tab, where finished jobs are. */
  onRecords: () => void;
}

/**
 * A worker's Jobs tab: the shared frame (Needs you, Agents talking, Agreed by day, Done), each job a card that opens its
 * card with its own actions, with the worker's nudges (the lowest price after a move, the UPI ID, bookings, mentors,
 * the card) under its heading: Home is the chat, with nothing above its greeting.
 */
export function Today({ ports, view, device, run, account, onRecords, ...moves }: Props) {
  return (
    <ActivityFrame
      now={ports.clock.now()}
      hint="activity.hint_worker"
      onRecords={onRecords}
      view={view}
      device={device}
      run={run}
      onAddPayee={moves.onAddPayee}
      rules={account.worker}
      lead={<WorkerNudges ports={ports} view={view} device={device} run={run} account={account} {...moves} />}
    />
  );
}
