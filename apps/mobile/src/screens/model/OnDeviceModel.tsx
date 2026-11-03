import type { MessageKey } from "@gigsync/core";
import { ModelState, type ModelStatus } from "@gigsync/plugin-llm";
import { ENGINE_NONE, engineName, useChosenModel } from "../../adapters/model.js";
import { currentNetwork } from "../../adapters/model-device.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { DownloadLine, networkNote, percentOf, sizeMb } from "./modelText.js";
import "./model.css";

const STATE_KEYS: Partial<Record<ModelState, MessageKey>> = {
  [ModelState.available]: "model.state_ready",
  [ModelState.downloadable]: "model.state_downloadable",
  [ModelState.downloading]: "model.state_downloading",
};

/** One line on what this phone has: the model, its size and state, or why it cannot run one. */
function stateLine(status: ModelStatus | undefined, t: ReturnType<typeof useI18n>["t"]): string {
  if (!status) return t("model.checking");
  if (status.reason) return t(`model.why.${status.reason}`);
  if (status.engine === ENGINE_NONE) return t("model.none");
  const key = status.state && STATE_KEYS[status.state];
  if (!key || !status.model) {
    const free = status.freeMemoryMb === undefined ? "" : ` · ${t("model.free_mb", { mb: status.freeMemoryMb })}`;
    return `${engineName(status)} · ${t(status.available ? "model.ready" : "model.not_ready")}${free}`;
  }
  const state = t(key, { percent: percentOf(status) });
  return t("model.line", { name: status.model.name, mb: status.model.downloadMb, state });
}

/**
 * Settings › On-device model, the model itself: name, size and state, its download with progress (the owner's tap is
 * the consent) and Remove.
 */
export function OnDeviceModel() {
  const { t } = useI18n();
  const model = useChosenModel();
  const { device } = model;
  const status = device.status;
  const mb = sizeMb(status);
  const note = networkNote(currentNetwork(), mb, t);
  const downloadable = status?.state === ModelState.downloadable;

  return (
    <div className={C.stack}>
      <div className={C.row}>
        <span className={C.muted}>{stateLine(status, t)}</span>
        <button type={C.button} className={`${C.linkBtn} end`} onClick={() => void model.refresh()}>
          {t("model.check")}
        </button>
      </div>
      {device.downloading && <DownloadLine status={status} t={t} />}
      {downloadable && (
        <div className={C.stack}>
          {device.record.wanted && <span className={C.muted}>{t("model.paused")}</span>}
          {note && <span className={C.faint}>{note}</span>}
          <div>
            <button type={C.button} className={C.secondary} onClick={() => void device.download()}>
              {t(device.record.wanted ? "model.resume" : "model.download", { mb })}
            </button>
          </div>
        </div>
      )}
      {status?.available && status.state && (
        <div>
          <button type={C.button} className={C.secondary} onClick={() => void device.remove()}>
            {t("model.remove")}
          </button>
        </div>
      )}
    </div>
  );
}
