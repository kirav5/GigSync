import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";

/** How many screens sign-in can take after the welcome: the number, the code, the two choices and the name. */
export const START_STEPS = 4;
const DOTS = Array.from({ length: START_STEPS }, (_, i) => i + 1);

/**
 * Back, and a dot per step with the current one drawn long. Not a <header>: before sign-in there is no banner, and
 * the tests (and a screen reader) take the banner to mean signed in. The phone's own Back is not handled before
 * sign-in, so this is the way back a step; a step that cannot go back (the name, after the code is used) has none.
 */
export function StartBar({ step, onBack }: { step: number; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="start-bar">
      {onBack && (
        <button type={C.button} className="start-back" aria-label={t("a11y.back")} onClick={onBack}>
          <Icon name="back" size={22} />
        </button>
      )}
      <span className="start-dots" aria-hidden="true">
        {DOTS.map((n) => (
          <span key={n} className="start-dot" data-on={n === step || undefined} />
        ))}
      </span>
    </div>
  );
}
