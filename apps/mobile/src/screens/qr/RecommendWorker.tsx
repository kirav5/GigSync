import { type GigDevice, type JobRecord, log, type MessageKey } from "@gigsync/core";
import { useId, useState } from "react";
import { copyText } from "../../adapters/clipboard.js";
import { myQrLink } from "../../adapters/links.js";
import { ShareResult, shareLink, whatsAppLink } from "../../adapters/share.js";
import { useI18n } from "../../i18n.js";
import { qrErrorKey } from "../../qr/problems.js";
import { BusyGroup } from "../../ui/BusyGroup.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { useBusy } from "../../ui/useBusy.js";
import "../../payments/money.css";
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
 * "Recommend {name} to someone you know" on a household's job, after the review (ADR 0055). The first tap gets the
 * worker's link from the server, so WhatsApp and Copy link cannot be ready before it; the second sends it through the
 * phone's own apps, a tap the share sheet and the clipboard will still accept, and the owner picks someone from their
 * own contacts. GigSync reads no contacts and never sees whom. Share is kept beside them for phones that list more
 * apps in their share sheet; WhatsApp and Copy link come first because some web views have no share sheet.
 */
export function RecommendWorker({ device, run, job, name, work }: Props) {
  const { t } = useI18n();
  const { busy, guard } = useBusy();
  const id = job.engagement.id;
  const [link, setLink] = useState<string>();
  const [status, setStatus] = useState<MessageKey>();
  const words = t("qr.recommend_words", { name, work });
  const titleId = useId();

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
    <section className={`${C.stack} recommend`} aria-labelledby={titleId}>
      <h3 id={titleId} className={C.title}>
        {t("money.recommend_title", { name })}
      </h3>
      <BusyGroup busy={busy}>
        {!link && (
          <button type={C.button} className={C.secondary} onClick={() => void guard(open)}>
            <Icon name="share" />
            {t("qr.recommend", { name })}
          </button>
        )}
        {link && (
          <fieldset className={C.stack} aria-label={t("qr.recommend", { name })}>
            <span className={C.muted}>{t("qr.recommend_about", { name })}</span>
            <div className="share-grid roomy">
              <a
                className={C.secondary}
                href={whatsAppLink(`${words} ${link}`)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void guard(() => sent("qr.shared"))}
              >
                <Icon name="whatsapp" />
                {t("qr.recommend_whatsapp")}
              </a>
              <button type={C.button} className={C.secondary} onClick={() => void guard(copy)}>
                <Icon name="copy" />
                {t("qr.copy")}
              </button>
              <button type={C.button} className={C.secondary} onClick={() => void guard(share)}>
                <Icon name="share" />
                {t("qr.share")}
              </button>
            </div>
          </fieldset>
        )}
      </BusyGroup>
      {!link && <p className="fine">{t("money.recommend_private")}</p>}
      <span className={C.muted} role="status" aria-live="polite">
        {status && t(status, { name })}
      </span>
    </section>
  );
}
