import type { CSSProperties } from "react";
import { money } from "../../ui/places.js";
import "./estimate.css";

const PERCENT = 100;
const MIDDLE = PERCENT / 2;

/** Where `typical` sits between `low` and `high`, as a share of the bar; the middle when the range is one amount. */
function typicalAt(low: number, typical: number, high: number): number {
  if (high <= low) return MIDDLE;
  return Math.min(PERCENT, Math.max(0, ((typical - low) / (high - low)) * PERCENT));
}

/** The band as a slider: the amount the owner picks between low and high, in steps, and its accessible name. */
export interface BandPick {
  value: number;
  step: number;
  label: string;
  onChange: (paise: number) => void;
}

/**
 * An estimate's usual range as a bar (the worker's price question, the household's budget): low at the left end, high
 * at the right, a tick at the typical amount with that amount (and `unit`, "a visit") over it, and `caption`, what the
 * range rests on, under it. Amounts are paise. It draws only what it is given; the words come from the caller.
 * Given `pick`, it is a slider: the tick and the figure over it follow the amount the owner drags or taps to.
 */
export function EstimateBand({
  low,
  typical,
  high,
  unit,
  caption,
  pick,
}: {
  low: number;
  typical: number;
  high: number;
  unit?: string | undefined;
  caption?: string | undefined;
  pick?: BandPick | undefined;
}) {
  const shown = pick?.value ?? typical;
  // One custom property places the fill's end, the tick and the figure, so the three always agree.
  const at: CSSProperties & { "--at": string } = { "--at": `${typicalAt(low, shown, high)}%` };
  return (
    <figure className="est-band" style={at}>
      <span className="est-typical">{unit ? `${money(shown)} ${unit}` : money(shown)}</span>
      <span className="est-slide">
        <span className="est-track" aria-hidden="true">
          <span className="est-fill" />
          <span className="est-tick" />
        </span>
        {pick && (
          <input
            className="est-range"
            type="range"
            min={low}
            max={high}
            step={pick.step}
            value={shown}
            aria-label={pick.label}
            aria-valuetext={money(shown)}
            onChange={(e) => pick.onChange(Number(e.currentTarget.value))}
          />
        )}
      </span>
      <span className="est-ends">
        <span>{money(low)}</span>
        <span>{money(high)}</span>
      </span>
      {caption && <figcaption className="fine">{caption}</figcaption>}
    </figure>
  );
}
