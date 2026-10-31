import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { NoticeWords } from "../record/NoticeWords.js";
import { PageFrame } from "./PageFrame.js";

/**
 * Where "Terms and Privacy Notice" leads, from the sign-in line and from Settings (ADR 0039 §4). The documents are
 * still being written, so it says so and, meanwhile, what GigSync keeps and never keeps. `onBack` is for the sign-in
 * screen, which has no top bar to go back with.
 */
export function TermsPage({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n();
  const title = t("records.terms_title");
  return (
    <PageFrame title={title}>
      <section className={C.card} aria-label={title}>
        <p>{t("records.terms_writing")}</p>
        <NoticeWords />
        {onBack && (
          <div className={C.actions}>
            <button type={C.button} className={C.secondary} onClick={onBack}>
              {t("records.terms_back")}
            </button>
          </div>
        )}
      </section>
    </PageFrame>
  );
}
