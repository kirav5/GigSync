import type { MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { type Pull, PullState } from "./useRecordFile.js";

/**
 * The line under a record file's button once it is done: where the file was saved, that GigSync keeps nothing to put
 * in it (`empty`, in the words for what was asked), or that it could not be reached.
 */
export function FileSaid({ pull, empty }: { pull: Pull; empty: MessageKey }) {
  const { t } = useI18n();
  let said: string | undefined;
  if (pull.state === PullState.saved) said = t("records.downloaded", { file: pull.file });
  else if (pull.state === PullState.empty) said = t(empty);
  else if (pull.state === PullState.failed) said = t("records.export_failed");
  if (!said) return null;
  return (
    <span className={C.faint} role="status">
      {said}
    </span>
  );
}
