import { asciiDigits } from "@gigsync/core";
import { useEffect, useRef } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { CODE_LENGTH, DEV_CODE, Field } from "./form.js";
import { StartBar } from "./StartBar.js";

const NOT_A_DIGIT = /\D/g;
const BOXES = Array.from({ length: CODE_LENGTH }, (_, i) => i);

/** What was typed or pasted, as the code's digits: any script's numbers, nothing else, no more than the code holds. */
const codeDigits = (typed: string) => asciiDigits(typed).replace(NOT_A_DIGIT, "").slice(0, CODE_LENGTH);

/**
 * The code from the SMS: one numeric field, drawn as a box per number, that signs in by itself when the last number is
 * in. iPhone's keyboard offers the code from the SMS (`one-time-code`); there is no call-me fallback, because nothing
 * on the server can place a call, so Send the code again stands in its place.
 */
export function CodeStep({
  phone,
  code,
  busy,
  onCode,
  onBack,
}: {
  /** The number as the owner typed it. */
  phone: string;
  code: string;
  busy: boolean;
  onCode: (digits: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);

  return (
    <>
      <StartBar title={t("signin.code")} onBack={onBack} />
      <h1 className={C.title}>{t("start.code_sent", { phone: phone.trim() })}</h1>
      <div className="code-boxes">
        <input
          ref={field}
          className="code-input"
          name={Field.code}
          aria-label={t("signin.code")}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          required
          readOnly={busy}
          value={code}
          onChange={(e) => onCode(codeDigits(e.target.value))}
        />
        {BOXES.map((i) => (
          <span key={i} className="code-box" data-next={i === code.length || undefined} aria-hidden="true">
            {code[i]}
          </span>
        ))}
      </div>
      <p className={C.muted}>{t("start.code_auto")}</p>
      {import.meta.env.DEV && <p className="fine">{t("signin.code_dev", { code: DEV_CODE })}</p>}
    </>
  );
}

/** The code step's dock: the code again, or back to the number to change it. */
export function CodeActions({
  busy,
  onResend,
  onChange,
}: {
  busy: boolean;
  onResend: () => void;
  onChange: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="start-actions">
      <button type={C.button} className={C.secondary} disabled={busy} onClick={onResend}>
        {t("start.code_again")}
      </button>
      <button type={C.button} className="btn ghost" onClick={onChange}>
        {t("start.change_number")}
      </button>
    </div>
  );
}
