import { C } from "./cls.js";

/**
 * An on/off switch drawn as a pill with a knob, green when on (`.toggle` in styles.css). A button with the switch role,
 * so a reader hears its name and whether it is on; `describedBy` names the words beside it that say what it does. The
 * button is a full 48px target around the smaller pill.
 */
export function Toggle({
  checked,
  onChange,
  label,
  describedBy,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  describedBy?: string | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <button
      type={C.button}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      className="toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track">
        <span className="toggle-knob" />
      </span>
    </button>
  );
}
