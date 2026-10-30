import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { PageFrame } from "../pages/PageFrame.js";

/** What the notice says: what is kept, why, what never is, and how to delete. Also read again from Privacy. */
export function NoticeWords() {
  const { t } = useI18n();
  return (
    <>
      <p>{t("records.notice_kept")}</p>
      <p>{t("records.notice_why")}</p>
      <p>
        <strong>{t("records.notice_never")}</strong>
      </p>
      <p className={C.muted}>{t("records.notice_delete")}</p>
    </>
  );
}

interface Props {
  /** The owner agreed; rejects when GigSync could not be reached, and the notice stays. */
  onAgree: () => Promise<void>;
  /** Not now: nothing is kept, and the notice comes back next time. */
  onLater: () => void;
}

/**
 * The notice about job records (ADR 0038 §5), in the owner's language and plainly: what GigSync keeps, why, what it
 * never keeps, and how to delete. Shown at sign-up and once to everyone already signed in; nothing about a job is
 * sent before "I agree".
 */
export function RecordsNotice({ onAgree, onLater }: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  function agree() {
    setBusy(true);
    setFailed(false);
    onAgree()
      .catch(() => setFailed(true))
      .finally(() => setBusy(false));
  }

  const title = t("records.notice_title");
  return (
    <PageFrame title={title}>
      <section className={C.card} aria-label={title}>
        <NoticeWords />
        <div className={C.actions}>
          <button type={C.button} className={C.accent} disabled={busy} onClick={agree}>
            {t("records.agree")}
          </button>
          <button type={C.button} className={C.secondary} disabled={busy} onClick={onLater}>
            {t("records.not_now")}
          </button>
        </div>
        <p className={failed ? C.dockError : C.faint} role="status" aria-live="polite">
          {t(failed ? "records.agree_failed" : "records.not_now_about")}
        </p>
      </section>
    </PageFrame>
  );
}
