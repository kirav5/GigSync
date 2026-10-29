import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** Profile's way into the landing journey: "Moving to a new city". */
export function MovingEntry({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  const title = t("landing.title");
  return (
    <section className={C.card} aria-label={title}>
      <span className={C.label}>{title}</span>
      <span>{t("landing.profile_hint")}</span>
      <div className={C.actions}>
        <button type={C.button} className={C.secondary} onClick={onOpen}>
          {t("landing.open")}
        </button>
      </div>
    </section>
  );
}
