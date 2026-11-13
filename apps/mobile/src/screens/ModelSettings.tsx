import { ModelState } from "@gigsync/plugin-llm";
import { useChosenModel } from "../adapters/model.js";
import { currentNetwork } from "../adapters/model-device.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { DownloadLine, networkNote, percentOf, sizeMb } from "./model/modelText.js";
import "./model/model.css";

/**
 * The model on this phone, as the last block of Settings' Your agent, and only once the owner has one or is fetching
 * it: its progress, a paused download to carry on, or Remove to free the space. Which model answers is the Privacy
 * switch's choice ("Let GigSync's model read my chats"), and the download itself is offered in the chat when it would
 * help, so nothing here asks the owner to pick a model or explains one.
 */
export function ModelSettings() {
  const { t } = useI18n();
  const { device } = useChosenModel();
  const status = device.status;
  const kept = Boolean(status?.available && status.state);
  const paused = Boolean(device.record.wanted) && status?.state === ModelState.downloadable;
  if (!kept && !paused && !device.downloading) return null;
  const mb = sizeMb(status);
  const state = t(kept ? "model.state_ready" : "model.state_downloading", { percent: percentOf(status) });
  const note = paused ? networkNote(currentNetwork(), mb, t) : undefined;
  return (
    <section className="setting-block" aria-label={t("model.title")}>
      <span className="list-row-title">{t("model.title")}</span>
      <span className={C.muted}>{t("model.kept_line", { mb, state })}</span>
      {device.downloading && <DownloadLine status={status} t={t} />}
      {paused && <span className={C.muted}>{t("model.paused")}</span>}
      {note && <span className={C.faint}>{note}</span>}
      {(kept || paused) && (
        <div>
          {paused ? (
            <button type={C.button} className={C.secondary} onClick={() => void device.download()}>
              {t("model.resume", { mb })}
            </button>
          ) : (
            <button type={C.button} className={C.secondary} onClick={() => void device.remove()}>
              {t("model.remove")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
