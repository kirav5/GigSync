import { type ReactNode, useId } from "react";
import { Toggle } from "../../ui/Toggle.js";

interface Props {
  /** The row's words, and the switch's name: what a reader hears and a test selects it by. */
  title: string;
  /** What the switch does, under the title; read out with the switch as its description. */
  sub?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean | undefined;
}

/**
 * One rule as a row of a list card (the design's switch rows): the title over its line, and the switch at the end.
 * The whole row is not the target, only the switch, so the line can hold a link or a status of its own.
 */
export function ToggleRow({ title, sub, checked, onChange, disabled = false }: Props) {
  const id = useId();
  return (
    <div className="list-row">
      <span className="list-row-text">
        <span className="list-row-title">{title}</span>
        {sub && (
          <span id={id} className="list-row-sub">
            {sub}
          </span>
        )}
      </span>
      <Toggle
        checked={checked}
        onChange={onChange}
        label={title}
        describedBy={sub ? id : undefined}
        disabled={disabled}
      />
    </div>
  );
}
