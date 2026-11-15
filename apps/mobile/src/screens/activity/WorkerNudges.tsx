import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { PayeeNudge } from "../../payments/PayeeNudge.js";
import { CardState } from "../../state.js";
import type { GigView } from "../../useGig.js";
import { MentorToday } from "../mentor/MentorToday.js";
import { FloorAsk } from "../move/FloorAsk.js";
import { RecommendedNotes } from "../qr/RecommendedNotes.js";
import { TodayBookings } from "../schedule/TodayBookings.js";
import { CardNudge } from "./CardNudge.js";

export interface NudgeMoves {
  /** Opens Talk with the card interview. */
  onMakeCard: () => void;
  /** Opens My card, where it goes back on the board. */
  onOpenCard: () => void;
  /** Opens About me, where the UPI ID is added. */
  onAddPayee: () => void;
  /** The account changed here (the lowest price given after the card came back). */
  onSaved: (a: Account) => void;
}

interface Props extends NudgeMoves {
  ports: Ports;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  account: Account;
}

function cardState(account: Account): CardState {
  if (!account.worker) return CardState.none;
  return account.listed === false ? CardState.off : CardState.on;
}

/**
 * What only a worker is asked, at the top of their Jobs tab, as Home is their chat and nothing stands above its
 * greeting: the lowest price after a move, the UPI ID, today's bookings, mentors, a household's recommendation, and
 * making or listing their card. Each draws nothing while it has nothing to say.
 */
export function WorkerNudges({ ports, view, device, run, account, ...moves }: Props) {
  return (
    <>
      <FloorAsk ports={ports} account={account} onSaved={moves.onSaved} />
      <PayeeNudge ports={ports} view={view} onAdd={moves.onAddPayee} />
      <TodayBookings ports={ports} />
      <MentorToday account={account} device={device} run={run} syncedAt={view.syncedAt} />
      <RecommendedNotes view={view} device={device} run={run} />
      <CardNudge card={cardState(account)} onMakeCard={moves.onMakeCard} onOpenCard={moves.onOpenCard} />
    </>
  );
}
