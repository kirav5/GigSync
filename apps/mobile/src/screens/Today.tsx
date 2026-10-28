import type { GigDevice, Ports } from "@gigsync/core";
import type { CardState } from "../state.js";
import type { GigView } from "../useGig.js";
import { Requests } from "./Requests.js";

interface Props {
  ports: Ports;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  card: CardState;
  /** Opens Talk with the card interview. */
  onMakeCard: () => void;
  onOpenCard: () => void;
  /** Opens Profile, where the UPI ID is added. */
  onAddPayee: () => void;
}

/** The worker's home: what to decide now and today's jobs. Until its sections are built, every job in one list. */
export function Today({ view, device, run }: Props) {
  return <Requests isWorker view={view} device={device} run={run} />;
}
