import { answerFromMemory, log, type MemoryOwner, type MessageKey, setAnswerFromMemory } from "@gigsync/core";
import { AnswerFromMemory } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const LABEL: Readonly<Record<AnswerFromMemory, MessageKey>> = {
  ask: "memory.answer_ask",
  auto: "memory.answer_auto",
};

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * "When my agent knows an answer from my past jobs: Ask me first / Answer for me". It governs both the Find chat's
 * remembered details and the answers to a worker's questions; a fact over a year old is never used on its own.
 */
export function AnswerSetting({ owner }: { owner: MemoryOwner }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<AnswerFromMemory>();

  useEffect(() => {
    answerFromMemory(owner)
      .then(setMode)
      .catch((err: unknown) => log.warn("loading the answer setting failed", failure(err)));
  }, [owner]);

  function choose(next: AnswerFromMemory) {
    setAnswerFromMemory(owner, next)
      .then(() => setMode(next))
      .catch((err: unknown) => log.warn("saving the answer setting failed", failure(err)));
  }

  const label = t("memory.answer_label");
  return (
    <fieldset className={C.stack} aria-label={label}>
      <span className={C.muted}>{label}</span>
      <div className={C.row}>
        {AnswerFromMemory.options.map((m) => (
          <button
            key={m}
            type={C.button}
            aria-pressed={mode === m}
            className={mode === m ? C.chipOn : C.chip}
            onClick={() => choose(m)}
          >
            {t(LABEL[m])}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
