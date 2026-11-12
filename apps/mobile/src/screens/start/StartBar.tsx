import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";

/**
 * Back and the step's name, drawn as the signed-in top bar is. Not a <header>: before sign-in there is no banner, and
 * the tests (and a screen reader) take the banner to mean signed in. The phone's own Back is not handled before
 * sign-in, so this is the way back a step.
 */
export function StartBar({ title, onBack }: { title: string; onBack: () => void }) {
  const { t } = useI18n();
  return (
    <div className="start-bar">
      <button type={C.button} className="start-back" aria-label={t("a11y.back")} onClick={onBack}>
        <Icon name="back" size={22} />
      </button>
      <span className="start-bar-title">{title}</span>
    </div>
  );
}
