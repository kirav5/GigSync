import type { GigDevice, NeedTo, Ports } from "@gigsync/core";
import type { Trade } from "@gigsync/protocol";
import { useState } from "react";
import { type Account, AccountRole } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { BarEnd } from "../../ui/Bar.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { ListCard } from "../../ui/ListRow.js";
import { BlockedPeople } from "./BlockedPeople.js";
import { PersonRow } from "./PersonRow.js";
import { PersonSheet } from "./PersonSheets.js";
import { type KnownOne, useKnownPeople } from "./useKnownPeople.js";
import "./me.css";

/** Between a worker's trades, and between their work and the count of jobs under their name. */
const LIST = ", ";
const PARTS = " · ";

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  /** Runs the owner's action, then syncs. */
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** When this phone last synced: a job signed meanwhile adds its person. */
  syncedAt: Date | undefined;
  /** Asks a worker again: a new Find chat addressed to them alone (ADR 0053 §5). */
  onAsk: (to: NeedTo) => void;
}

/** What a row says under a name: their work (or Household), and how many jobs they did with the owner. */
function useLine() {
  const { t, plural } = useI18n();
  return ({ person, memory }: KnownOne) => {
    const what = person.worker ? person.card.trades.map((tr) => t(`trade.${tr}`)).join(LIST) : t("qr.household");
    const jobs = memory?.jobs;
    return jobs ? what + PARTS + plural("me.people_jobs", jobs) : what;
  };
}

/** Whether someone matches what was typed: in their name or the name of a trade they do, in the owner's language. */
function matches(one: KnownOne, typed: string, trade: (tr: Trade) => string): boolean {
  const words = [one.person.card.name, ...one.person.card.trades.map(trade)].join(" ").toLocaleLowerCase();
  return words.includes(typed);
}

/** The top bar's search button, which shows and hides the field. */
function SearchButton({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <BarEnd>
      <button
        type={C.button}
        className="bar-icon"
        aria-label={label}
        aria-pressed={on}
        title={label}
        onClick={onToggle}
      >
        <Icon name="search" size={22} />
      </button>
    </BarEnd>
  );
}

/**
 * People you know (design P8), for a worker and a household alike: everyone they had a job signed with or a mentor
 * link to (ADR 0031's "know"), blocked ones apart in their own list with Unblock. Tapping someone offers what the owner
 * can do with them: a household asks a worker again (ADR 0053 §5); anyone can block. A search kept on this phone opens
 * from the top bar. GigSync never learns who recommended whom (ADR 0055), so there is no "Recommended to you".
 */
export function People({ ports, account, device, run, syncedAt, onAsk }: Props) {
  const { t } = useI18n();
  const line = useLine();
  const { known, blocked, refresh } = useKnownPeople(ports, account, device, syncedAt);
  const [searching, setSearching] = useState(false);
  const [typed, setTyped] = useState("");
  const [open, setOpen] = useState<KnownOne>();
  const asks = account.role === AccountRole.consumer;
  const searchLabel = t("me.people_search");
  // Closing the search shows everyone again; what was typed waits for the next time it opens.
  const query = searching ? typed.trim().toLocaleLowerCase() : "";
  const shown = known?.filter((one) => matches(one, query, (tr) => t(`trade.${tr}`)));
  const ask = (one: KnownOne) => {
    const { user, card } = one.person;
    onAsk({ user, name: card.name, trades: card.trades });
  };
  return (
    <>
      {known && known.length > 0 && (
        <SearchButton label={searchLabel} on={searching} onToggle={() => setSearching((on) => !on)} />
      )}
      <p className={C.muted}>{t("me.people_sub")}</p>
      {searching && (
        <input
          className={C.field}
          type="search"
          aria-label={searchLabel}
          placeholder={searchLabel}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          // biome-ignore lint/a11y/noAutofocus: the owner tapped search to type; the field is what they asked for.
          autoFocus
        />
      )}
      {known?.length === 0 && blocked?.length === 0 && <p className={C.empty}>{t("me.people_none")}</p>}
      {known && known.length > 0 && shown?.length === 0 && <p className={C.empty}>{t("me.people_no_match")}</p>}
      {shown && shown.length > 0 && (
        <ListCard>
          {shown.map((one) => (
            <PersonRow key={one.person.user} name={one.person.card.name} sub={line(one)} onClick={() => setOpen(one)} />
          ))}
        </ListCard>
      )}
      {blocked && <BlockedPeople device={device} blocked={blocked} run={run} onChanged={refresh} />}
      {open && (
        <PersonSheet
          name={open.person.card.name}
          line={line(open)}
          onAsk={asks && open.person.worker ? () => ask(open) : undefined}
          block={() => run(() => device.mentors.block(open.person.user))}
          onChanged={refresh}
          onClose={() => setOpen(undefined)}
        />
      )}
    </>
  );
}
