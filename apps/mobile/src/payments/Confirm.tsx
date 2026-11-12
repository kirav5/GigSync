import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

/** One more tap before money is recorded as received: it is confirmed on both phones at once and cannot be taken back. */
export function Confirm({ ask, onAnswer }: { ask: string; onAnswer: (yes: boolean) => void }) {
  const { t } = useI18n();
  return (
    <div className={C.stack}>
      <span>{ask}</span>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={() => onAnswer(true)}>
          {t("flag.yes")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => onAnswer(false)}>
          {t("flag.no")}
        </button>
      </div>
    </div>
  );
}
