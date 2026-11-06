import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { PayeeNudge } from "../payments/PayeeNudge.js";
import { CardState } from "../state.js";
import { C } from "../ui/cls.js";
import type { GigView } from "../useGig.js";
import { ActivityFrame } from "./activity/ActivityFrame.js";
import { MentorToday } from "./mentor/MentorToday.js";
import { FloorAsk } from "./move/FloorAsk.js";
import { RecommendedNotes } from "./qr/RecommendedNotes.js";
import { TodayBookings } from "./schedule/TodayBookings.js";

interface Props {
  ports: Ports;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  card: CardState;
  /** Opens Talk with the card interview. */
  onMakeCard: () => void;
  onOpenCard: () => void;
  /** Opens About me, where the UPI ID is added. */
  onAddPayee: () => void;
  /** Opens Records, where finished jobs are. */
  onRecords: () => void;
  /** Whose phone this is: a mentor's answer to a newcomer carries their card. */
  account: Account;
  /** The account changed here (the lowest price given after the card came back). */
  onSaved: (a: Account) => void;
}

/**
 * A worker's Activity: the shared frame (Awaiting you, In talks, Agreed by day, Closed into Records), with the
 * worker's own nudges above the counters: the lowest price after a move, the UPI ID, a mentor's note, a household's
 * recommendation, their own bookings (ADR 0048), and making or listing their card. Each job card carries its own actions, so the screen has no dock.
 */
export function Today(props: Props) {
  const { ports, view, device, run, card, onMakeCard, onOpenCard, onAddPayee, onRecords, account, onSaved } = props;
  const { t } = useI18n();
  const top = (
    <>
      <FloorAsk ports={ports} account={account} onSaved={onSaved} />
      <PayeeNudge ports={ports} view={view} onAdd={onAddPayee} />
      <MentorToday account={account} device={device} run={run} syncedAt={view.syncedAt} />
      <RecommendedNotes view={view} device={device} run={run} />
      <TodayBookings ports={ports} />
      {card === CardState.none && (
        <div className={C.card}>
          <span>{t("home.no_card")}</span>
          <div className={C.actions}>
            <button type={C.button} className={C.accent} onClick={onMakeCard}>
              {t("home.make_card")}
            </button>
          </div>
        </div>
      )}
      {card === CardState.off && (
        <div className={C.card}>
          <span>{t("home.card_off")}</span>
          <div className={C.actions}>
            <button type={C.button} className={C.secondary} onClick={onOpenCard}>
              {t("nav.card")}
            </button>
          </div>
        </div>
      )}
    </>
  );
  return (
    <ActivityFrame
      now={ports.clock.now()}
      top={top}
      byDay
      hint="activity.hint_worker"
      onRecords={onRecords}
      view={view}
      device={device}
      run={run}
      onAddPayee={onAddPayee}
    />
  );
}
