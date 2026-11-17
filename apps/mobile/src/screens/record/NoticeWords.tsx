import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/**
 * What GigSync keeps, why, what it never keeps, and how to delete (ADR 0038 §5): read in Privacy before agreeing again.
 */
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
