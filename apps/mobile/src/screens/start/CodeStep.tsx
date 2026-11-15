import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { CodeBoxes } from "../../ui/CodeBoxes.js";
import { C } from "../../ui/cls.js";
import { DEV_CODE, Field } from "./form.js";
import { Art, StartArt, Tone } from "./StartArt.js";
import { StartBar } from "./StartBar.js";

/** How long before the code can be sent again: an SMS usually lands well inside it. */
const RESEND_AFTER_S = 30;
const SECOND_MS = 1000;

/**
 * The code from the SMS: one numeric field, drawn as a box per number, that signs in by itself when the last number is
 * in. iPhone's keyboard offers the code from the SMS (`one-time-code`), Android's from its SMS suggestion; there is
 * no call-me fallback, so Send again stands in its place.
 */
export function CodeStep({
  step,
  phone,
  code,
  busy,
  onCode,
  onBack,
}: {
  step: number;
  /** The number as the owner typed it. */
  phone: string;
  code: string;
  busy: boolean;
  onCode: (digits: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <StartBar step={step} onBack={onBack} />
      <StartArt art={Art.code} tone={Tone.leaf} small />
      <div className="start-head">
        <h1 className="start-title">{t("start.code_title")}</h1>
        <p className={C.muted}>
          {t("start.code_sent", { phone: phone.trim() })} ·{" "}
          <button type={C.button} className={C.linkBtn} onClick={onBack}>
            {t("start.change_number")}
          </button>
        </p>
      </div>
      <CodeBoxes name={Field.code} label={t("signin.code")} code={code} busy={busy} onCode={onCode} />
      <p className={C.muted}>{t("start.code_auto")}</p>
      {import.meta.env.DEV && <p className="fine">{t("signin.code_dev", { code: DEV_CODE })}</p>}
    </>
  );
}

/** Seconds left before the code can be sent again, counting down from each send (`sentAt` moves on every one). */
function useWait(sentAt: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), SECOND_MS);
    return () => clearInterval(tick);
  }, []);
  return Math.min(RESEND_AFTER_S, Math.max(0, RESEND_AFTER_S - Math.floor((now - sentAt) / SECOND_MS)));
}

/** The code step's dock: the code again once the wait is over. */
export function CodeActions({ busy, sentAt, onResend }: { busy: boolean; sentAt: number; onResend: () => void }) {
  const { t } = useI18n();
  const wait = useWait(sentAt);
  return (
    <button type={C.button} className={C.secondary} disabled={busy || wait > 0} onClick={onResend}>
      {wait > 0 ? t("start.code_again_in", { seconds: wait }) : t("start.code_again")}
    </button>
  );
}
