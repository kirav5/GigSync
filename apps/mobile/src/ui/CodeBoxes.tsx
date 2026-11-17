import { asciiDigits } from "@gigsync/core";
import { OtpVerify } from "@gigsync/protocol";
import { useEffect, useRef } from "react";
import "./codeBoxes.css";

/** The code the development API accepts, shown only in dev builds. */
export const DEV_CODE = "000000";
/** How many numbers an SMS code has: the length the server checks it against. */
export const CODE_LENGTH = OtpVerify.shape.code.maxLength ?? DEV_CODE.length;
const NOT_A_DIGIT = /\D/g;
const BOXES = Array.from({ length: CODE_LENGTH }, (_, i) => i);
const NUMERIC = "numeric";
/** iPhone's keyboard offers the code from the SMS for this; Android's SMS suggestion fills it too. */
const ONE_TIME_CODE = "one-time-code";

/** What was typed or pasted, as the code's digits: any script's numbers, nothing else, no more than the code holds. */
const codeDigits = (typed: string) => asciiDigits(typed).replace(NOT_A_DIGIT, "").slice(0, CODE_LENGTH);

/**
 * An SMS code: one numeric field, drawn as a box per number, focused when it appears. Sign-in and the Aadhaar's second
 * number both use it; the caller acts once all the numbers are in.
 */
export function CodeBoxes({
  name,
  label,
  code,
  busy,
  onCode,
}: {
  name: string;
  label: string;
  code: string;
  busy: boolean;
  onCode: (digits: string) => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  return (
    <div className="code-boxes">
      <input
        ref={field}
        className="code-input"
        name={name}
        aria-label={label}
        inputMode={NUMERIC}
        autoComplete={ONE_TIME_CODE}
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
  );
}
