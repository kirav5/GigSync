import type { MessageKey } from "@gigsync/core";
import { useState } from "react";
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

/**
 * "New conversation", with one confirm: it clears what is on screen from this phone. When a card interview is not
 * finished, the confirm says its answers are kept.
 */
export function NewConversation({ unfinished, onClear }: { unfinished: boolean; onClear: () => void }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const label = t("agent.new");
  if (!asking)
    return (
      <button type={C.button} className={C.quiet} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  return (
    <div className={C.cardWait} role="dialog" aria-label={label}>
      <p>{t(unfinished ? "agent.new_confirm_card" : "agent.new_confirm")}</p>
      <div className={C.actions}>
        <button
          type={C.button}
          className={C.accent}
          onClick={() => {
            setAsking(false);
            onClear();
          }}
        >
          {t("agent.new_yes")}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => setAsking(false)}>
          {t("agent.keep")}
        </button>
      </div>
    </div>
  );
}
