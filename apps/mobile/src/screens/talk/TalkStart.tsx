import type { MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** One way into Talk, shown only while the conversation is empty. */
export interface Suggestion {
  label: MessageKey;
  /** Runs the suggestion; it gets the words as shown, so they appear as the owner's own. */
  run: (said: string) => void;
}

/**
 * An empty Talk: a line saying what to do, and up to three things workers ask most. They go away after the first
 * message, as in other assistants; voice and typing do the same and more.
 */
export function Suggestions({ items }: { items: readonly Suggestion[] }) {
  const { t } = useI18n();
  return (
    <div className={C.stack}>
      <span className={C.muted}>{t("agent.empty")}</span>
      <div className={C.row}>
        {items.map(({ label, run }) => (
          <button key={label} type={C.button} className={C.chip} onClick={() => run(t(label))}>
            {t(label)}
          </button>
        ))}
      </div>
    </div>
  );
}
