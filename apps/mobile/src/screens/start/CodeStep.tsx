import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { CodeBoxes } from "../../ui/CodeBoxes.js";
import { C } from "../../ui/cls.js";
import { DEV_CODE, Field } from "./form.js";
import { Art, StartArt } from "./StartArt.js";
import { StartBar } from "./StartBar.js";

/** How long before the code can be sent again: an SMS usually lands well inside it. */
const RESEND_AFTER_S = 30;
const SECOND_MS = 1000;
const SECONDS_PER_MINUTE = 60;

/**
 * The code from the SMS: one numeric field, drawn as a box per number, that signs in by itself when the last number is
 * in. iPhone's keyboard offers the code from the SMS (`one-time-code`), Android's from its SMS suggestion; there is
 * no call-me fallback, so Send again stands in its place, as a quiet line under the boxes that counts down and then
 * turns into a link.
 */
export function CodeStep({
  step,
  phone,
  code,
  busy,
  sentAt,
  onCode,
  onResend,
  onBack,
}: {
  step: number;
  /** The number as the owner typed it. */
  phone: string;
  code: string;
  busy: boolean;
  /** When the code was last sent: the wait before Send again counts from it. */
  sentAt: number;
  onCode: (digits: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <StartBar step={step} onBack={onBack} />
      <StartArt art={Art.code} small />
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
      <div className="start-code-foot">
        <p className={C.muted}>{t("start.code_auto")}</p>
        <SendAgain busy={busy} sentAt={sentAt} onResend={onResend} />
      </div>
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

/** A wait as a clock shows it: 0:30. */
const clock = (seconds: number) =>
  `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${String(seconds % SECONDS_PER_MINUTE).padStart(2, "0")}`;

/** "Send again in 0:30" while the SMS may still come, then "Send the code again" as a link. */
export function SendAgain({ busy, sentAt, onResend }: { busy: boolean; sentAt: number; onResend: () => void }) {
  const { t } = useI18n();
  const wait = useWait(sentAt);
  if (wait > 0) return <p className={`${C.muted} start-wait`}>{t("start.code_again_in", { time: clock(wait) })}</p>;
  return (
    <button type={C.button} className={C.linkBtn} disabled={busy} onClick={onResend}>
      {t("start.code_again")}
    </button>
  );
}
