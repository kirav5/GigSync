import { C } from "../../ui/cls.js";

/** One choice among chips: what it stands for and its words. */
export interface ChipOption<T> {
  value: T;
  text: string;
}

/** A labelled row of chips, the chosen ones pressed. Picking one calls `onPick`; the caller decides what that means. */
export function ChipPick<T extends string | number>({
  label,
  options,
  chosen,
  onPick,
}: {
  label: string;
  options: readonly ChipOption<T>[];
  chosen: readonly T[];
  onPick: (value: T) => void;
}) {
  return (
    <fieldset className={C.stack} aria-label={label}>
      <span className={C.fieldLabel}>{label}</span>
      <div className={C.row}>
        {options.map((o) => {
          const on = chosen.includes(o.value);
          return (
            <button
              key={o.value}
              type={C.button}
              aria-pressed={on}
              className={on ? C.chipOn : C.chip}
              onClick={() => onPick(o.value)}
            >
              {o.text}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
