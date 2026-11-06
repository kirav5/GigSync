import { log, type MessageKey, myWorkRecord, recordCsv } from "@gigsync/core";
import { useId, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { recordsClient } from "../../adapters/records.js";
import { Saved, saveTextFile } from "../../adapters/saveFile.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { csvWords } from "./csvWords.js";
import "./record.css";

/** The file's name before the day it was made: no person's name in it, so it can be sent on as it is. */
const FILE_PREFIX = "gigsync-work-record-";
const CSV = { extension: ".csv", type: "text/csv" } as const;
/** Length of "YYYY-MM-DD" at the start of an ISO timestamp. */
const DAY_LENGTH = 10;

/** Where the download stands: not asked, coming, failed, nothing kept, or saved under a name. */
const PullState = {
  idle: "idle",
  loading: "loading",
  failed: "failed",
  empty: "empty",
  saved: "saved",
} as const;
type Pull =
  | { state: Exclude<(typeof PullState)[keyof typeof PullState], typeof PullState.saved> }
  | { state: typeof PullState.saved; file: string };

/** What the row says under it once a download ended. */
const SAID: Readonly<Record<typeof PullState.failed | typeof PullState.empty, MessageKey>> = {
  [PullState.failed]: "records.export_failed",
  [PullState.empty]: "records.export_empty",
};

/**
 * "Download my work record" in Records (ADR 0038 §4): one quiet row that pulls every job GigSync keeps for this
 * worker from the server (GET /v1/jobs/records/mine), the same on any phone they sign in to, and saves it as a CSV
 * file to keep or show anyone. The jobs themselves are listed in Records already, so nothing is listed twice.
 */
export function DownloadRecord({ account }: { account: Account }) {
  const { t } = useI18n();
  const about = useId();
  const [pull, setPull] = useState<Pull>({ state: PullState.idle });
  const loading = pull.state === PullState.loading;

  async function download() {
    setPull({ state: PullState.loading });
    try {
      const jobs = await myWorkRecord(recordsClient(account.session));
      if (jobs.length === 0) return setPull({ state: PullState.empty });
      const file = `${FILE_PREFIX}${new Date().toISOString().slice(0, DAY_LENGTH)}${CSV.extension}`;
      const how = await saveTextFile(file, recordCsv(jobs, csvWords(t)), CSV.type);
      setPull(how === Saved.cancelled ? { state: PullState.idle } : { state: PullState.saved, file });
    } catch (err: unknown) {
      log.warn("work record not pulled", { error: err instanceof Error ? err.name : String(err) });
      setPull({ state: PullState.failed });
    }
  }

  return (
    <div className="record-download">
      <button
        type={C.button}
        className={C.quiet}
        aria-describedby={about}
        disabled={loading}
        aria-busy={loading}
        onClick={() => void download()}
      >
        {t(loading ? "records.export_loading" : "records.download_title")}
      </button>
      <span id={about} className={C.faint}>
        {t("records.download_about")}
      </span>
      <Said pull={pull} />
    </div>
  );
}

/** The row's status line: where the file was saved, or why there is none. */
function Said({ pull }: { pull: Pull }) {
  const { t } = useI18n();
  if (pull.state === PullState.saved) {
    return (
      <span className={C.faint} role="status">
        {t("records.downloaded", { file: pull.file })}
      </span>
    );
  }
  if (pull.state !== PullState.failed && pull.state !== PullState.empty) return null;
  return (
    <span className={C.faint} role="status">
      {t(SAID[pull.state])}
    </span>
  );
}
