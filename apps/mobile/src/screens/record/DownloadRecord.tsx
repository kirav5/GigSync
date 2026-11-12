import type { MessageKey } from "@gigsync/core";
import type { Role } from "@gigsync/protocol";
import { useId } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { FileSaid } from "./FileSaid.js";
import { fileName, PullState, today, useRecordFile } from "./useRecordFile.js";
import "./record.css";

/** The button's words, the line under it, what an empty record says, and the file's name, for each side. */
const SIDE: Readonly<Record<Role, { title: MessageKey; about: MessageKey; empty: MessageKey; prefix: string }>> = {
  provider: {
    title: "records.download_title",
    about: "records.download_about",
    empty: "records.export_empty",
    prefix: "gigsync-work-record-",
  },
  requester: {
    title: "ledger.download_receipts",
    about: "ledger.receipts_about",
    empty: "ledger.receipts_empty",
    prefix: "gigsync-receipts-",
  },
};

/**
 * "Download my work record" for a worker, "Download receipts" for a household (ADR 0038 §4): every job GigSync keeps
 * for this owner on their side, saved as a CSV file to keep or show anyone. The jobs themselves are listed on the
 * screen already, so nothing is listed twice.
 */
export function DownloadRecord({ account, side }: { account: Account; side: Role }) {
  const { t } = useI18n();
  const about = useId();
  const { pull, save } = useRecordFile(account);
  const words = SIDE[side];
  const loading = pull.state === PullState.loading;
  const download = () => save({ side, keep: (job) => job.role === side, name: () => fileName(words.prefix, today()) });

  return (
    <div className="record-download">
      <button
        type={C.button}
        className={C.secondary}
        aria-describedby={about}
        disabled={loading}
        aria-busy={loading}
        onClick={() => void download()}
      >
        <Icon name="doc" />
        {t(loading ? "records.export_loading" : words.title)}
      </button>
      <span id={about} className={C.faint}>
        {t(words.about)}
      </span>
      <FileSaid pull={pull} empty={words.empty} />
    </div>
  );
}
