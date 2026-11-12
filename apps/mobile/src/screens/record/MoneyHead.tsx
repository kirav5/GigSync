import { money } from "../../ui/places.js";
import "./record.css";

/** One small tile under the big figure: an amount in paise over what it is. */
export interface Stat {
  id: string;
  paise: number;
  label: string;
}

/** Between the head's label and what is said beside it. */
const PARTS = " · ";

interface Props {
  /** The big figure, in paise. */
  paise: number;
  /** What the figure is, as its own element: a test or a reader finds the figure beside it. */
  label: string;
  /** Said after the label ("5 payments", "since March 2026"). */
  aside?: string | undefined;
  stats: readonly Stat[];
}

/**
 * The head of the Money and Pay tabs (designs W15, H13): one big amount with what it is, then two small tiles. The big
 * line is the screen's heading, as it is the first thing the owner comes to the tab for.
 */
export function MoneyHead({ paise, label, aside, stats }: Props) {
  return (
    <div className="money-top">
      <h1 className="money-head">
        <b className="money-big">{money(paise)}</b> <span>{label}</span>
        {aside && (
          <span>
            {PARTS}
            {aside}
          </span>
        )}
      </h1>
      <div className="stat-grid">
        {stats.map((s) => (
          <div key={s.id} className="stat">
            <b>{money(s.paise)}</b> <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
