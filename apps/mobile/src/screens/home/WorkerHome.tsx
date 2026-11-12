import type { GigDevice, Ports } from "@gigsync/core";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { PayeeNudge } from "../../payments/PayeeNudge.js";
import type { CardState } from "../../state.js";
import { C } from "../../ui/cls.js";
import type { GigView } from "../../useGig.js";
import { MentorToday } from "../mentor/MentorToday.js";
import { FloorAsk } from "../move/FloorAsk.js";
import { RecommendedNotes } from "../qr/RecommendedNotes.js";
import { TodayBookings } from "../schedule/TodayBookings.js";
import { CardNudge } from "./CardNudge.js";
import { HomeJobs } from "./HomeJobs.js";
import { MoneyCard } from "./MoneyCard.js";
import { NeedsBanner } from "./NeedsBanner.js";
import { TalkEntry } from "./TalkEntry.js";
import "./home.css";

interface Props {
  ports: Ports;
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Whose phone this is: the passbook's payee, and a mentor's answer to a newcomer carries their card. */
  account: Account;
  card: CardState;
  /** Opens Talk with the card interview. */
  onMakeCard: () => void;
  onOpenCard: () => void;
  /** Opens About me, where the UPI ID is added. */
  onAddPayee: () => void;
  /** The account changed here (the lowest price given after the card came back). */
  onSaved: (a: Account) => void;
  /** Opens Talk, the chat with the worker's agent. */
  onTalk: () => void;
  /** Opens the Jobs tab, where decisions wait. */
  onJobs: () => void;
  /** Opens the Money tab. */
  onMoney: () => void;
}

/**
 * A worker's Home tab (design W7): what needs them (the one interruption), money first, then today's jobs and who
 * their agent is talking to, each opening the Jobs tab, and the way into Talk. Below, the nudges that are the
 * worker's alone: the lowest price after a move, the UPI ID, their bookings, mentors, a household's recommendation,
 * and making or listing their card. Nothing here acts on a job; that happens on its card under Jobs.
 */
export function WorkerHome(props: Props) {
  const { ports, view, device, run, account, onSaved, onJobs } = props;
  const { t, time } = useI18n();
  const now = ports.clock.now();
  return (
    <>
      <NeedsBanner view={view} onJobs={onJobs} />
      <FloorAsk ports={ports} account={account} onSaved={onSaved} />
      <MoneyCard view={view} me={account.session.user} now={now} onMoney={props.onMoney} />
      <PayeeNudge ports={ports} view={view} onAdd={props.onAddPayee} />
      <HomeJobs view={view} now={now} bookings={<TodayBookings ports={ports} />} onJobs={onJobs} />
      <TalkEntry onTalk={props.onTalk} />
      <MentorToday account={account} device={device} run={run} syncedAt={view.syncedAt} />
      <RecommendedNotes view={view} device={device} run={run} />
      <CardNudge card={props.card} onMakeCard={props.onMakeCard} onOpenCard={props.onOpenCard} />
      {view.syncedAt && <p className={C.faint}>{t("requests.checked", { time: time(view.syncedAt) })}</p>}
    </>
  );
}
