import type { GigDevice } from "@gigsync/core";
import type { ChosenWorker } from "../find/ask.js";
import type { GigView } from "../useGig.js";
import { ActivityFrame } from "./activity/ActivityFrame.js";
import { OfferCards } from "./qr/OfferCards.js";

interface Props {
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Opens a Find chat addressed to a worker who offered to work. */
  onAsk: (worker: ChosenWorker) => void;
  /** Opens Records, where finished jobs are. */
  onRecords: () => void;
}

/**
 * A household's Activity: the same frame as a worker's. Offers to work from someone who scanned their QR wait on them
 * first, under Awaiting you, with answering the worker, signing and saying whether a payment went; the jobs agreed
 * (pay, review) are one list under Agreed.
 */
export function Requests({ view, device, run, onAsk, onRecords }: Props) {
  const more = {
    count: view.offers.length,
    node: <OfferCards offers={view.offers} device={device} run={run} onAsk={onAsk} />,
  };
  return (
    <ActivityFrame
      now={new Date()}
      more={more}
      byDay={false}
      hint="activity.hint_household"
      onRecords={onRecords}
      view={view}
      device={device}
      run={run}
    />
  );
}
