import { allMyRecords, log, recordCsv } from "@gigsync/core";
import type { ExportedJob, Role } from "@gigsync/protocol";
import { useState } from "react";
import type { Account } from "../../adapters/account.js";
import { recordsClient } from "../../adapters/records.js";
import { Saved, saveTextFile } from "../../adapters/saveFile.js";
import { useI18n } from "../../i18n.js";
import { csvWords } from "./csvWords.js";

const CSV = { extension: ".csv", type: "text/csv" } as const;
/** Length of "YYYY-MM-DD" at the start of an ISO timestamp. */
const DAY_LENGTH = 10;

/** Where a file stands: not asked, coming, failed, nothing kept to put in it, or saved under a name. */
export const PullState = {
  idle: "idle",
  loading: "loading",
  failed: "failed",
  empty: "empty",
  saved: "saved",
} as const;
type PullState = (typeof PullState)[keyof typeof PullState];
export type Pull =
  | { state: Exclude<PullState, typeof PullState.saved> }
  | { state: typeof PullState.saved; file: string };

/** A file's name: what it holds, then a day ("YYYY-MM-DD"). No person's name, so it can be sent on as it is. */
export const fileName = (prefix: string, day: string): string => `${prefix}${day}${CSV.extension}`;

/** Today's day for a file's name. */
export const today = (): string => new Date().toISOString().slice(0, DAY_LENGTH);

/** What to put in a file: the jobs to keep, the owner's side of them, and the file's name from the first kept. */
export interface FileAsk {
  side: Role;
  keep: (job: ExportedJob) => boolean;
  name: (first: ExportedJob) => string;
}

/**
 * Pulls the jobs GigSync keeps for this owner (GET /v1/jobs/records/mine, ADR 0038 §4), the same on any phone they sign
 * in to, and saves the ones asked for as a CSV file in the owner's words: through the share sheet, or as a download.
 */
export function useRecordFile(account: Account): { pull: Pull; save: (ask: FileAsk) => Promise<void> } {
  const { t } = useI18n();
  const [pull, setPull] = useState<Pull>({ state: PullState.idle });

  async function save({ side, keep, name }: FileAsk) {
    setPull({ state: PullState.loading });
    try {
      const jobs = (await allMyRecords(recordsClient(account.session))).filter(keep);
      const [first] = jobs;
      if (!first) return setPull({ state: PullState.empty });
      const file = name(first);
      const how = await saveTextFile(file, recordCsv(jobs, csvWords(t, side)), CSV.type);
      setPull(how === Saved.cancelled ? { state: PullState.idle } : { state: PullState.saved, file });
    } catch (err: unknown) {
      log.warn("record file not pulled", { error: err instanceof Error ? err.name : String(err) });
      setPull({ state: PullState.failed });
    }
  }

  return { pull, save };
}
