import type { MessageKey } from "@gigsync/core";
import { ModelChoice, useChosenModel } from "../adapters/model.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";

/** The chip's words for each engine that can answer. */
const ENGINE_CHIP: Readonly<Record<ModelChoice, MessageKey>> = {
  [ModelChoice.auto]: "shell.model_device",
  [ModelChoice.device]: "shell.model_device",
  [ModelChoice.lite]: "shell.model_lite",
  [ModelChoice.ollama]: "shell.model_ollama",
  [ModelChoice.server]: "shell.model_server",
};

/** Grey ink for lite mode, peri for a model that answers. */
const CHIP = "engine-chip";
const CHIP_MODEL = "engine-chip peri";

/**
 * What runs the agent, as collab's "Powered by" chip: GigSync's model, the phone's own model, Ollama in development,
 * or lite mode. With `onOpen` it is a button to Settings (the wide rail); in Settings itself it only says.
 */
export function EngineChip({ onOpen }: { onOpen?: () => void }) {
  const { t } = useI18n();
  const model = useChosenModel();
  const engine = model.answering();
  const cls = engine === ModelChoice.lite ? CHIP : CHIP_MODEL;
  const words = `✦ ${t(ENGINE_CHIP[engine], { name: model.current.ollamaModel })}`;
  if (!onOpen) return <span className={cls}>{words}</span>;
  return (
    <button type={C.button} className={cls} title={t("shell.model_about")} onClick={onOpen}>
      {words}
    </button>
  );
}
