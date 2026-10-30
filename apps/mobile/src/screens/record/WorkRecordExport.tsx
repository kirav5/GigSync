import { jobDay, log, myWorkRecord, paidFor, recordCsv, workTotals } from "@gigsync/core";
import type { ExportedJob } from "@gigsync/protocol";
import { useState } from "react";
import type { Account } from "../../adapters/account.js";
import { recordsClient } from "../../adapters/records.js";
import { Saved, saveTextFile } from "../../adapters/saveFile.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { csvWords, STATUS_WORD } from "./csvWords.js";
import "./record.css";

/** The file's name before the day it was made: no person's name in it, so it can be sent on as it is. */
const FILE_PREFIX = "gigsync-work-record-";
const CSV = { extension: ".csv", type: "text/csv" } as const;
/** Length of "YYYY-MM-DD" at the start of an ISO timestamp. */
const DAY_LENGTH = 10;

/** Where the pull stands: not asked, coming, failed, or here. */
const PullState = { idle: "idle", loading: "loading", failed: "failed", loaded: "loaded" } as const;
type Pull =
  | { state: typeof PullState.idle | typeof PullState.loading | typeof PullState.failed }
  | { state: typeof PullState.loaded; jobs: ExportedJob[] };

/**
 * "My work record" in Receipts (ADR 0038 §4): every job GigSync keeps for this worker, pulled from the server so it is
 * the same on any phone they sign in to, with Download as a CSV file to keep or show anyone.
 */
export function WorkRecordExport({ account }: { account: Account }) {
  const { t } = useI18n();
  const [pull, setPull] = useState<Pull>({ state: PullState.idle });
  const [saved, setSaved] = useState<string>();

  function load() {
    setPull({ state: PullState.loading });
    myWorkRecord(recordsClient(account.session))
      .then((jobs) => setPull({ state: PullState.loaded, jobs }))
      .catch((err: unknown) => {
        log.warn("work record not pulled", { error: err instanceof Error ? err.name : String(err) });
        setPull({ state: PullState.failed });
      });
  }

  async function download(jobs: ExportedJob[]) {
    const name = `${FILE_PREFIX}${new Date().toISOString().slice(0, DAY_LENGTH)}${CSV.extension}`;
    const how = await saveTextFile(name, recordCsv(jobs, csvWords(t)), CSV.type);
    setSaved(how === Saved.cancelled ? undefined : name);
  }

  const title = t("records.export_title");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span className={C.muted}>{t("records.export_about")}</span>
      {pull.state !== PullState.loaded && (
        <div className={C.actions}>
          <button type={C.button} className={C.secondary} disabled={pull.state === PullState.loading} onClick={load}>
            {t(pull.state === PullState.loading ? "records.export_loading" : "records.export_open")}
          </button>
        </div>
      )}
      {pull.state === PullState.failed && (
        <p className={C.dockError} role="status">
          {t("records.export_failed")}
        </p>
      )}
      {pull.state === PullState.loaded && (
        <Loaded jobs={pull.jobs} onDownload={() => void download(pull.jobs)} saved={saved} />
      )}
    </section>
  );
}

function Loaded({
  jobs,
  onDownload,
  saved,
}: {
  jobs: ExportedJob[];
  onDownload: () => void;
  saved?: string | undefined;
}) {
  const { t } = useI18n();
  if (jobs.length === 0) return <p className={C.empty}>{t("records.export_empty")}</p>;
  const totals = workTotals(jobs);
  return (
    <>
      <div className="passbook-totals kept-totals">
        <div>
          <span className={C.label}>{t("records.export_jobs")}</span>
          <b>{totals.jobs}</b>
        </div>
        <div>
          <span className={C.label}>{t("records.export_received")}</span>
          <b>{money(totals.earned_paise)}</b>
        </div>
        <div>
          <span className={C.label}>{t("records.export_rated")}</span>
          <b>{totals.rated}</b>
        </div>
      </div>
      <ul className="record-list" aria-label={t("records.export_title")}>
        {jobs.map((j) => (
          <li key={j.engagement} className="kept-job">
            <span>
              {jobDay(j)} · {t(`trade.${j.work.trade}`)} · {t(STATUS_WORD[j.status])}
            </span>
            <span className={C.faint}>{t(j.attested ? "records.attested_both" : "records.attested_you")}</span>
            <span className={C.muted}>
              {t("records.export_row", { price: money(j.price_paise), paid: money(paidFor(j)) })}
              {j.stars !== undefined && ` · ★ ${j.stars}`}
            </span>
          </li>
        ))}
      </ul>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={onDownload}>
          {t("records.download")}
        </button>
      </div>
      {saved && (
        <p className={C.faint} role="status">
          {t("records.downloaded", { file: saved })}
        </p>
      )}
    </>
  );
}
