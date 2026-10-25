import type { Ports } from "@gigsync/core";
import { ModelDownload } from "@gigsync/plugin-llm";
import { useEffect, useState } from "react";
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
import { C } from "../ui/cls.js";

const CHOICES: readonly { choice: ModelChoice; label: string; about: string }[] = [
  {
    choice: ModelChoice.auto,
    label: "Auto",
    about: `Use this device's model when it is ready and has ${MIN_FREE_MB} MB free; otherwise lite mode.`,
  },
  {
    choice: ModelChoice.device,
    label: "On-device",
    about: "Always use this device's own model. Falls back to lite mode only if it cannot answer.",
  },
  {
    choice: ModelChoice.lite,
    label: "Lite mode",
    about: "No model at all. Rules and templates do every job: agreeing, recording, getting paid.",
  },
  ...(OLLAMA_OFFERED
    ? [
        {
          choice: ModelChoice.ollama,
          label: "Ollama (dev)",
          about: "Development builds only: a model served by `ollama serve` on this computer.",
        },
      ]
    : []),
];

/** Which model the agent uses, with what this device actually has. Nothing here ever uses a cloud model. */
export function ModelSettings({ ports }: { ports: Ports }) {
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
    ? "Checking this device…"
    : status.engine === ENGINE_NONE
      ? "This device has no on-device model yet. Desktop Chrome can provide one; phone browsers cannot."
      : `${engine} · ${status.available ? "ready" : "not ready"}${
          status.freeMemoryMb === undefined ? "" : ` · ${status.freeMemoryMb} MB free`
        }`;

  return (
    <div className={C.card}>
      <span className={C.label}>On-device model</span>
      <div className={C.row}>
        <span className={C.muted}>{deviceLine}</span>
        <button type={C.button} className={`${C.linkBtn} end`} onClick={() => void model.refresh()}>
          Check again
        </button>
      </div>
      <div className={C.row}>
        {CHOICES.map((c) => (
          <button
            key={c.choice}
            type={C.button}
            aria-pressed={choice === c.choice}
            className={choice === c.choice ? "chip on" : "chip"}
            onClick={() => choose(c.choice)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {status?.download === ModelDownload.downloadable && (
        <div className={C.stack}>
          <span className={C.muted}>
            Chrome can download its built-in model once for this computer (several GB; needs about 22 GB free). It runs
            on this computer only, never in the cloud.
          </span>
          <div>
            <button type={C.button} className={C.secondary} onClick={() => void model.prepare()}>
              Download Chrome's model
            </button>
          </div>
        </div>
      )}
      {status?.download === ModelDownload.downloading && (
        <span className={C.muted}>Chrome is downloading its model. Tap Check again in a few minutes.</span>
      )}
      <span className={C.faint}>{CHOICES.find((c) => c.choice === choice)?.about}</span>
      {choice === ModelChoice.ollama && OLLAMA_OFFERED && (
        <div className={C.row}>
          {pulled && pulled.length > 0 ? (
            <select
              className={C.field}
              aria-label="Ollama model"
              value={ollamaName}
              onChange={(e) => setOllamaName(e.target.value)}
            >
              <option value="">Choose a model Ollama has</option>
              {pulled.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={C.field}
              aria-label="Ollama model name"
              placeholder={
                pulled ? "Ollama is not running: start `ollama serve`, or type a name" : "Looking for Ollama…"
              }
              value={ollamaName}
              onChange={(e) => setOllamaName(e.target.value)}
              autoComplete={C.off}
            />
          )}
          <button type={C.button} className={C.secondary} onClick={saveOllama} disabled={!ollamaName.trim()}>
            Use this model
          </button>
        </div>
      )}
      <span className={C.label}>Now answering: {model.label()}</span>
      {choice === ModelChoice.auto && !deviceUsable(status) && status && (
        <span className={C.faint}>Everything still works in lite mode; a model only helps with wording.</span>
      )}
    </div>
  );
}
