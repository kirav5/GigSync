import { useI18n } from "../../i18n.js";
import { Greeting, type GreetingRow } from "../home/Greeting.js";

interface Props {
  /** The worker's name, for the greeting. */
  name: string;
  /** The worker has a card: its price can change; without one, the row makes it. */
  hasCard: boolean;
  /** Opens the Jobs tab, where today's jobs are. */
  onJobs: () => void;
  /** Starts the card chat at the price, with the row's words as the worker's own. */
  onPrice: (said: string) => void;
  /** Starts the card chat from the beginning. */
  onMakeCard: () => void;
  /** Opens Get verified, the ID check on this phone. */
  onVerify: () => void;
}

/** An empty Talk: the design's greeting and its three ways in, today's jobs, the price (or the card), and verifying. */
export function TalkStart({ name, hasCard, onJobs, onPrice, onMakeCard, onVerify }: Props) {
  const { t } = useI18n();
  const rows: GreetingRow[] = [
    { icon: "jobs", label: "home.suggest_jobs", onPick: onJobs },
    hasCard
      ? { icon: "pencil", label: "agent.suggest_rate", onPick: () => onPrice(t("agent.suggest_rate")) }
      : { icon: "card", label: "home.make_card", onPick: onMakeCard },
    { icon: "shield", label: "home.suggest_verify", onPick: onVerify },
  ];
  return <Greeting name={name} line="agent.empty" rows={rows} />;
}
