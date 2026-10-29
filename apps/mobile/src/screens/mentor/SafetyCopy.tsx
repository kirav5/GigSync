import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/**
 * The safety words, in the owner's language, before any contact with a mentor or a newcomer: meet in public, never pay
 * through a mentor, report anyone who asks for money or documents. With `onRead`, a button says they were read.
 */
export function SafetyCopy({ onRead }: { onRead?: () => void }) {
  const { t } = useI18n();
  const title = t("mentor.safety_title");
  return (
    <section className={`${C.card} mentor-safety`} aria-label={title}>
      <span className={C.label}>{title}</span>
      <ul>
        <li>{t("mentor.safety_public")}</li>
        <li>{t("mentor.safety_money")}</li>
        <li>{t("mentor.safety_report")}</li>
      </ul>
      {onRead && (
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={onRead}>
            {t("mentor.safety_ok")}
          </button>
        </div>
      )}
    </section>
  );
}
