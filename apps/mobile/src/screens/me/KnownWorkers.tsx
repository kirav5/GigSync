import type { GigDevice, NeedTo, Ports } from "@gigsync/core";
import type { Trade } from "@gigsync/protocol";
import { useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { BarEnd } from "../../ui/Bar.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { ListCard } from "../../ui/ListRow.js";
import { PersonRow } from "./PersonRow.js";
import { type KnownWorker, useKnownWorkers } from "./useKnownWorkers.js";
import "./me.css";

/** Between a worker's trades, and between their work and the count of jobs under their name. */
const LIST = ", ";
const PARTS = " · ";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  /** When this phone last synced: a job signed meanwhile adds its worker. */
  syncedAt: Date | undefined;
  /** Asks one of them again: a new Find chat addressed to them alone (ADR 0053 §5). */
  onAsk: (to: NeedTo) => void;
}

/** One worker: their work and how many jobs they did for the owner (jobs, not visits: a month's work is one job). */
function WorkerRow({ worker, onAsk }: { worker: KnownWorker; onAsk: Props["onAsk"] }) {
  const { t, plural } = useI18n();
  const { user, card } = worker.person;
  const jobs = worker.memory?.jobs;
  const work = card.trades.map((tr) => t(`trade.${tr}`)).join(LIST);
  return (
    <PersonRow
      name={card.name}
      sub={jobs ? work + PARTS + plural("me.people_jobs", jobs) : work}
      end={
        // Its words are "Ask again"; its name adds whom, so a reader hears "Ask again, Lakshmi".
        <button
          type={C.button}
          className={C.quiet}
          aria-label={`${t("me.ask_again")} ${card.name}`}
          onClick={() => onAsk({ user, name: card.name, trades: card.trades })}
        >
          {t("me.ask_again")}
        </button>
      }
    />
  );
}

/** Whether a worker matches what was typed: in their name or the name of a trade they do, in the owner's language. */
function matches(worker: KnownWorker, typed: string, trade: (tr: Trade) => string): boolean {
  const words = [worker.person.card.name, ...worker.person.card.trades.map(trade)].join(" ").toLocaleLowerCase();
  return words.includes(typed);
}

/**
 * Workers you know (design P8), from a household's Me: everyone they had a job signed with or a mentor link to
 * (ADR 0031's "know"), blocked ones left out, each with Ask again, and a search kept on this phone, opened from the top
 * bar. The design's "Recommended to you" is not drawn: GigSync never learns who recommended whom (ADR 0055).
 */
export function KnownWorkers({ ports, account, device, syncedAt, onAsk }: Props) {
  const { t } = useI18n();
  const workers = useKnownWorkers(ports, account, device, syncedAt);
  const [searching, setSearching] = useState(false);
  const [typed, setTyped] = useState("");
  if (workers?.length === 0) return <p className={C.empty}>{t("me.people_none")}</p>;
  const label = t("me.people_search");
  // Closing the search shows everyone again; what was typed waits for the next time it opens.
  const query = searching ? typed.trim().toLocaleLowerCase() : "";
  const shown = workers?.filter((w) => matches(w, query, (tr) => t(`trade.${tr}`)));
  return (
    <>
      <BarEnd>
        <button
          type={C.button}
          className="bar-icon"
          aria-label={label}
          aria-pressed={searching}
          title={label}
          onClick={() => setSearching((on) => !on)}
        >
          <Icon name="search" size={22} />
        </button>
      </BarEnd>
      <p className={C.muted}>{t("me.people_sub")}</p>
      {searching && (
        <input
          className={C.field}
          type="search"
          aria-label={label}
          placeholder={label}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          // biome-ignore lint/a11y/noAutofocus: the owner tapped search to type; the field is what they asked for.
          autoFocus
        />
      )}
      {shown?.length === 0 && <p className={C.empty}>{t("me.people_no_match")}</p>}
      {shown && shown.length > 0 && (
        <ListCard>
          {shown.map((w) => (
            <WorkerRow key={w.person.user} worker={w} onAsk={onAsk} />
          ))}
        </ListCard>
      )}
    </>
  );
}
