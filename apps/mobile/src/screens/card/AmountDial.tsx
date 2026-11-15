import { parseAmount } from "@gigsync/core";
import { type RefObject, useRef } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { money, rupeesOf } from "../../ui/places.js";
import "./price.css";

/** Amounts are typed on the number pad. */
const NUMERIC = "numeric";
/** The class of a picked segment or day. */
export const PICKED = "on";

/** The amount in the field as paise, read as people type it ("4,500", "₹4500", "४५००"); undefined when none. */
export const paiseIn = (field: HTMLInputElement | null): number | undefined => parseAmount(field?.value ?? "");

/**
 * One amount, big and in serif as the design's "Your price" shows it, "₹199 / visit" on one line: tap it to type, or
 * step it with − and + at the two ends. The field stays a plain input with its own name, so a form reads it as before
 * and a screen may put an amount in it.
 */
export function AmountDial({
  label,
  initial,
  step,
  unit,
  name,
  inputRef,
  required,
  onAmount,
}: {
  label: string;
  initial?: number | undefined;
  step: number;
  unit?: string | undefined;
  name?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  required?: boolean;
  onAmount?: (paise: number | undefined) => void;
}) {
  const { t } = useI18n();
  const own = useRef<HTMLInputElement>(null);
  const field = inputRef ?? own;
  const by = (sign: number) => {
    const el = field.current;
    if (!el) return;
    const next = Math.max(0, (paiseIn(el) ?? 0) + sign * step);
    el.value = rupeesOf(next);
    onAmount?.(next || undefined);
  };
  const stepText = money(step);
  return (
    <div className="amount-dial">
      <button
        type={C.button}
        className="amount-step"
        aria-label={t("cardflow.less", { step: stepText })}
        onClick={() => by(-1)}
      >
        <Icon name="minus" size={22} />
      </button>
      <label className="amount-value">
        <span className="amount-figure">
          <span aria-hidden="true">₹</span>
          <input
            ref={field}
            name={name}
            aria-label={label}
            inputMode={NUMERIC}
            required={required}
            placeholder="0"
            defaultValue={rupeesOf(initial)}
            onChange={(e) => onAmount?.(paiseIn(e.currentTarget))}
          />
        </span>
        {unit && <small>{unit}</small>}
      </label>
      <button
        type={C.button}
        className="amount-step"
        aria-label={t("cardflow.more", { step: stepText })}
        onClick={() => by(1)}
      >
        <Icon name="plus" size={22} />
      </button>
    </div>
  );
}

/** One option of a segmented control: what it stands for and its words. */
export interface Segment<T extends string> {
  value: T;
  label: string;
}

/** A segmented control as the design draws it: the options side by side on a light track, the one picked a white pill. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: readonly Segment<T>[];
  value: T | undefined;
  onPick: (value: T) => void;
}) {
  return (
    <fieldset className="segmented" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type={C.button}
          aria-pressed={o.value === value}
          className={o.value === value ? PICKED : undefined}
          onClick={() => onPick(o.value)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}
