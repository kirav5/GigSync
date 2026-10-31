import { useEffect, useState } from "react";
import { Notice, useChosenModel } from "../../adapters/model.js";
import { currentNetwork } from "../../adapters/model-device.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { DownloadLine, networkNote, sizeMb } from "./modelText.js";
import "./model.css";

/**
 * The chat's few words about the phone's own model (LLD §9.1): one quiet offer on a phone that can run it, until the
 * owner answers; a slim line while it downloads; a paused download to resume; and once ready, one line saying the
 * agent runs on the phone now, then nothing more. Lite mode works the whole time.
 */
export function ModelNotice() {
  const { t } = useI18n();
  const { device, current } = useChosenModel();
  const notice = device.notice();
  // The ready line is said once: marked as said when it shows, and kept on screen until the owner leaves the chat.
  const [readyShown, setReadyShown] = useState(false);
  useEffect(() => {
    if (notice !== Notice.ready) return;
    setReadyShown(true);
    void device.sayReady();
  }, [notice, device]);

  if (readyShown) {
    return (
      <p className="model-ready" role="status">
        {t("model.ready_line")}
      </p>
    );
  }
  if (notice === Notice.downloading) return <DownloadLine status={device.status} t={t} />;
  if (notice !== Notice.offer && notice !== Notice.paused) return null;
  const mb = sizeMb(device.status, current.size);
  const note = networkNote(currentNetwork(), mb, t);
  const offer = notice === Notice.offer;
  return (
    <section className={`${C.card} model-offer`} aria-label={t("model.title")}>
      <p>{t(offer ? "model.offer" : "model.paused", { mb })}</p>
      {note && <p className={C.muted}>{note}</p>}
      {offer && <p className={C.faint}>{t("model.private")}</p>}
      <div className={C.row}>
        <button type={C.button} className={C.secondaryCompact} onClick={() => void device.download()}>
          {t(offer ? "model.offer_download" : "model.resume")}
        </button>
        {offer && (
          <button type={C.button} className={C.quiet} onClick={() => void device.later()}>
            {t("model.offer_later")}
          </button>
        )}
      </div>
    </section>
  );
}
