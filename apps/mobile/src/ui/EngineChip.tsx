import type { MessageKey } from "@gigsync/core";
import { ModelChoice, useChosenModel } from "../adapters/model.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

/** The chip's words for each engine that can answer; with none answering there is no chip. */
const ENGINE_CHIP: Readonly<Partial<Record<ModelChoice, MessageKey>>> = {
  [ModelChoice.auto]: "shell.model_device",
  [ModelChoice.device]: "shell.model_device",
  [ModelChoice.ollama]: "shell.model_ollama",
  [ModelChoice.server]: "shell.model_server",
};

const CHIP = "engine-chip peri";

/** The chip's words while a model answers; undefined while none can (rules and templates do every job, unnamed). */
export function useEngineWords(): string | undefined {
  const { t } = useI18n();
  const model = useChosenModel();
  const key = ENGINE_CHIP[model.answering()];
  return key && `✦ ${t(key, { name: model.current.ollamaModel })}`;
}

/**
 * What runs the agent, as collab's "Powered by" chip: GigSync's model, the phone's own model or Ollama in development;
 * nothing while no model answers. With `onOpen` it is a button to Settings (the wide rail); in Settings it only says.
 */
export function EngineChip({ onOpen }: { onOpen?: () => void }) {
  const { t } = useI18n();
  const words = useEngineWords();
  if (!words) return null;
  if (!onOpen) return <span className={CHIP}>{words}</span>;
  return (
    <button type={C.button} className={CHIP} title={t("shell.model_about")} onClick={onOpen}>
      {words}
    </button>
  );
}
