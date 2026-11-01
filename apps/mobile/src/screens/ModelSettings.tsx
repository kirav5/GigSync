import type { MessageKey, Ports } from "@gigsync/core";
import { ModelDownload } from "@gigsync/plugin-llm";
import { useEffect, useState } from "react";
import { EMBEDDING_PACK_MB, PackState, useUnderstanding } from "../adapters/embedder.js";
import {
  deviceUsable,
  ENGINE_NONE,
  engineName,
  MIN_FREE_MB,
  ModelChoice,
  OLLAMA_OFFERED,
  useChosenModel,
} from "../adapters/model.js";
import { listOllamaModels } from "../adapters/ollama.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

/** The understanding pack (ADR 0042): its state on this device, and the one tap that fetches it. */
function UnderstandingPack() {
  const { t } = useI18n();
  const pack = useUnderstanding();
  const model = useChosenModel();
  const lite = model.current.choice === ModelChoice.lite;
  const line =
    pack.state === PackState.ready
      ? t("pack.ready")
      : pack.state === PackState.downloading
        ? t("pack.downloading", { percent: pack.percent })
        : pack.state === PackState.failed
          ? t("pack.failed")
          : undefined;
  return (
    <section className={C.stack} aria-label={t("pack.title")}>
      <span className={C.label}>{t("pack.title")}</span>
      <span className={C.faint}>{t("pack.about", { mb: EMBEDDING_PACK_MB })}</span>
      {line && <span className={C.muted}>{line}</span>}
      {lite && pack.state === PackState.ready && <span className={C.muted}>{t("pack.lite")}</span>}
      {(pack.state === PackState.downloadable || pack.state === PackState.failed) && (
        <div>
          <button type={C.button} className={C.secondary} onClick={() => void pack.prepare()}>
            {t("pack.get", { mb: EMBEDDING_PACK_MB })}
          </button>
        </div>
      )}
    </section>
  );
}

const CHOICES: readonly { choice: ModelChoice; label: MessageKey; about: MessageKey }[] = [
  { choice: ModelChoice.auto, label: "model.auto", about: "model.auto_about" },
  { choice: ModelChoice.device, label: "model.device", about: "model.device_about" },
  { choice: ModelChoice.lite, label: "model.lite", about: "model.lite_about" },
  ...(OLLAMA_OFFERED
    ? [{ choice: ModelChoice.ollama, label: "model.ollama" as const, about: "model.ollama_about" as const }]
    : []),
];

/** Which model the agent uses, with what this device actually has. Nothing here ever uses a cloud model. */
export function ModelSettings({ ports }: { ports: Ports }) {
  const { t } = useI18n();
  const model = useChosenModel();
  const status = model.deviceInfo;
  const [ollamaName, setOllamaName] = useState(model.current.ollamaModel);
  const [pulled, setPulled] = useState<string[]>();
  const choice = model.current.choice;

  useEffect(() => setOllamaName(model.current.ollamaModel), [model.current.ollamaModel]);

  // Offer the models Ollama on this computer actually has, instead of asking for a name to be typed.
  useEffect(() => {
    if (choice === ModelChoice.ollama && OLLAMA_OFFERED) void listOllamaModels().then(setPulled);
  }, [choice]);

  const choose = (next: ModelChoice) => void model.save(ports.storage, { ...model.current, choice: next });
  const saveOllama = () => void model.save(ports.storage, { choice: ModelChoice.ollama, ollamaModel: ollamaName });

  const engine = status ? engineName(status.engine) : "…";
  const deviceLine = !status
    ? t("model.checking")
    : status.engine === ENGINE_NONE
      ? t("model.none")
      : `${engine} · ${t(status.available ? "model.ready" : "model.not_ready")}${
          status.freeMemoryMb === undefined ? "" : ` · ${t("model.free_mb", { mb: status.freeMemoryMb })}`
        }`;
  const chosen = CHOICES.find((c) => c.choice === choice);

  return (
    <div className={C.card}>
      <span className={C.label}>{t("model.title")}</span>
      <div className={C.row}>
        <span className={C.muted}>{deviceLine}</span>
        <button type={C.button} className={`${C.linkBtn} end`} onClick={() => void model.refresh()}>
          {t("model.check")}
        </button>
      </div>
      <div className={C.row}>
        {CHOICES.map((c) => (
          <button
            key={c.choice}
            type={C.button}
            aria-pressed={choice === c.choice}
            className={choice === c.choice ? C.chipOn : C.chip}
            onClick={() => choose(c.choice)}
          >
            {t(c.label)}
          </button>
        ))}
      </div>
      {status?.download === ModelDownload.downloadable && (
        <div className={C.stack}>
          <span className={C.muted}>{t("model.chrome_download_about")}</span>
          <div>
            <button type={C.button} className={C.secondary} onClick={() => void model.prepare()}>
              {t("model.chrome_download")}
            </button>
          </div>
        </div>
      )}
      {status?.download === ModelDownload.downloading && (
        <span className={C.muted}>{t("model.chrome_downloading")}</span>
      )}
      {chosen && <span className={C.faint}>{t(chosen.about, { mb: MIN_FREE_MB })}</span>}
      {choice === ModelChoice.ollama && OLLAMA_OFFERED && (
        <div className={C.row}>
          {pulled && pulled.length > 0 ? (
            <select
              className={C.field}
              aria-label={t("model.ollama_model")}
              value={ollamaName}
              onChange={(e) => setOllamaName(e.target.value)}
            >
              <option value="">{t("model.ollama_choose")}</option>
              {pulled.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={C.field}
              aria-label={t("model.ollama_name")}
              placeholder={t(pulled ? "model.ollama_off" : "model.ollama_looking")}
              value={ollamaName}
              onChange={(e) => setOllamaName(e.target.value)}
              autoComplete={C.off}
            />
          )}
          <button type={C.button} className={C.secondary} onClick={saveOllama} disabled={!ollamaName.trim()}>
            {t("model.use")}
          </button>
        </div>
      )}
      <span className={C.label}>{t("model.now", { model: model.label(t) })}</span>
      {choice === ModelChoice.auto && !deviceUsable(status) && status && (
        <span className={C.faint}>{t("model.still_works")}</span>
      )}
      <UnderstandingPack />
    </div>
  );
}
