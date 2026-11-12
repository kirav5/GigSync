import { type Ports, workRecord } from "@gigsync/core";
import { Role, type WorkerRecord } from "@gigsync/protocol";
import { useId, useMemo } from "react";
import type { Account } from "../../adapters/account.js";
import { useOwnCard } from "../../card/useOwnCard.js";
import { useI18n } from "../../i18n.js";
import { Badge, BadgeTone } from "../../ui/Badge.js";
import { C } from "../../ui/cls.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import type { GigView } from "../../useGig.js";
import { RecordSetting } from "../pages/RecordSetting.js";
import { RecordStats } from "../qr/RecordStats.js";
import { DownloadRecord } from "./DownloadRecord.js";
import { JobReceipt } from "./JobReceipt.js";
import { monthText } from "./text.js";
import { phoneOffset, useRecords } from "./useRecords.js";
import "./record.css";

interface Props {
  ports: Ports;
  account: Account;
  /** This phone's jobs and payments; the served record is read again after its syncs. */
  view: GigView;
  /** Opens My card, the part of the record households see. */
  onCard: () => void;
}

/** A card GigSync keeps no job for yet: its record shows zeros, not nothing. */
const NO_JOBS: WorkerRecord = { jobs: 0, rated: 0 };

/**
 * My record (design W16), from a worker's Me: the jobs she finished, for how many households, since when, as her
 * Money tab counts them, with the one badge GigSync can stand behind (her phone, checked by a code at sign-in). Then
 * the parts she can share: her card, or the record of one job; whether her card shows the record, and the record as
 * the card shows it, stars included (ADR 0036); and the whole record to download (ADR 0038 §4). No photo or ID badge,
 * and no union row: none of those exist.
 */
export function MyRecord({ ports, account, view, onCard }: Props) {
  const { lang, t, plural } = useI18n();
  const { card } = useOwnCard(ports, account, view.syncedAt);
  const now = useMemo(() => new Date(), []);
  const { done } = useRecords(view, now);
  const me = account.session.user;
  const record = useMemo(
    () => workRecord(done, view.payments, me, now, phoneOffset(now)),
    [done, view.payments, me, now],
  );
  const head = useId();
  const seen = useId();
  const rows = record.months.flatMap((m) => m.rows);
  return (
    <div className={C.stack}>
      <section className="card card-earth my-record" aria-labelledby={head}>
        <h1 id={head} className="hero-title">
          {plural("record.jobs", record.jobs)}
        </h1>
        <p className="fine">
          {record.since
            ? `${plural("record.households", record.households)} · ${t("record.since", { month: monthText(lang, record.since) })}`
            : t("ledger.record_none")}
        </p>
        <ul className="my-record-badges" aria-label={t("me.badges")}>
          <li>
            <Badge icon="check" tone={BadgeTone.green}>
              {t("me.phone")}
            </Badge>
          </li>
        </ul>
      </section>
      <p className="my-record-lead">{t("ledger.share_lead")}</p>
      <ListCard>
        <ListRow icon="home" title={t("ledger.share_card")} sub={t("ledger.share_card_sub")} onClick={onCard} />
        <JobReceipt account={account} rows={rows} names={view.names} />
      </ListCard>
      <RecordSetting ports={ports} account={account} />
      {card && (
        <section className={C.stack} aria-labelledby={seen}>
          <p id={seen} className="section-label">
            {t("ledger.on_card")}
          </p>
          <div className={C.card}>
            <RecordStats record={card.record ?? NO_JOBS} />
            {card.show_record === false && <span className={C.faint}>{t("record.card_hidden")}</span>}
          </div>
        </section>
      )}
      <DownloadRecord account={account} side={Role.enum.provider} />
    </div>
  );
}
