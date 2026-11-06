import { type GigDevice, type JobRecord, log, type MessageKey } from "@gigsync/core";
import { useState } from "react";
import { copyText } from "../../adapters/clipboard.js";
import { myQrLink } from "../../adapters/links.js";
import { ShareResult, shareLink, whatsAppLink } from "../../adapters/share.js";
import { useI18n } from "../../i18n.js";
import { qrErrorKey } from "../../qr/problems.js";
import { C } from "../../ui/cls.js";
import "./qr.css";

interface Props {
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** A job this household may recommend its worker from (`canRecommend`). */
  job: JobRecord;
  /** The worker, and their work in the owner's words: what the message says. */
  name: string;
  work: string;
}

/**
 * "Recommend {name}" on a household's job (ADR 0055). The first tap gets the worker's link; the second sends it through
 * the phone's own apps, so it is a tap the share sheet will still accept, and the owner picks someone from their own
 * contacts. GigSync never sees whom. WhatsApp and Copy link are there because some web views have no share sheet.
 */
export function RecommendWorker({ device, run, job, name, work }: Props) {
  const { t } = useI18n();
  const id = job.engagement.id;
  const [link, setLink] = useState<string>();
  const [status, setStatus] = useState<MessageKey>();
  const words = t("qr.recommend_words", { name, work });

  async function open() {
    setStatus(undefined);
    try {
      await run(async () => setLink(myQrLink(await device.recommendations.code(id))));
    } catch (err) {
      setStatus(qrErrorKey(err));
    }
  }
  /** The link went out, as far as this phone can tell: the worker is told, and the owner hears which. */
  async function sent(line: MessageKey) {
    setStatus(line);
    try {
      let told = false;
      await run(async () => {
        told = await device.recommendations.tell(id);
      });
      if (told) setStatus("qr.recommend_told");
    } catch (err) {
      log.warn("worker not told of a recommendation", { error: err instanceof Error ? err.name : String(err) });
    }
  }
  async function share() {
    if (!link) return;
    const result = await shareLink({ title: t("qr.share_title", { name }), text: words, url: link });
    if (result === ShareResult.shared) return sent("qr.shared");
    if (result === ShareResult.unsupported) return copy();
  }
  async function copy() {
    if (await copyText(`${words} ${link}`)) return sent("qr.copied");
    setStatus("qr.copy_failed");
  }

  return (
    <div className={C.stack}>
      {!link && (
        <button type={C.button} className={C.quiet} onClick={() => void open()}>
          {t("qr.recommend", { name })}
        </button>
      )}
      {link && (
        <fieldset className={C.cardWait} aria-label={t("qr.recommend", { name })}>
          <span className={C.muted}>{t("qr.recommend_about", { name })}</span>
          <div className="share-grid roomy">
            <button type={C.button} className={C.accent} onClick={() => void share()}>
              {t("qr.share")}
            </button>
            <a
              className={C.secondary}
              href={whatsAppLink(`${words} ${link}`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void sent("qr.shared")}
            >
              {t("qr.recommend_whatsapp")}
            </a>
            <button type={C.button} className={C.secondary} onClick={() => void copy()}>
              {t("qr.copy")}
            </button>
          </div>
        </fieldset>
      )}
      <span className={C.muted} role="status" aria-live="polite">
        {status && t(status, { name })}
      </span>
    </div>
  );
}
