import { money } from "../../ui/places.js";
import "./record.css";
import "./money-hero.css";

/** One small tile under the big figure: an amount in paise over what it is. */
export interface Stat {
  id: string;
  paise: number;
  label: string;
}

/** The week as bars: what came each day, Monday first, the day's short name, and which one is today. */
export interface WeekBars {
  days: readonly number[];
  names: readonly string[];
  today: number;
}

/** Between the head's label and what is said beside it. */
const PARTS = " · ";
/** The shortest bar still shows, so an empty day reads as a day and not a gap. */
const MIN_BAR_PERCENT = 6;
const FULL_PERCENT = 100;

interface Props {
  /** The big figure, in paise. */
  paise: number;
  /** What the figure is, as its own element: a test or a reader finds the figure beside it. */
  label: string;
  /** Said after the label ("5 payments", "since March 2026"). */
  aside?: string | undefined;
  /** What came today, as a small green pill beside the aside ("₹800 today"); nothing on a day with none. */
  today?: string | undefined;
  /** The week's days as bars under the figure: a worker's Money. */
  week?: WeekBars | undefined;
  stats: readonly Stat[];
}

/** Seven bars, today's in terracotta, each as tall as its day's money against the week's best day. */
function Bars({ week }: { week: WeekBars }) {
  const most = Math.max(...week.days, 1);
  return (
    <div className="money-week" aria-hidden="true">
      {week.days.map((paise, i) => (
        <span key={week.names[i] ?? i} className="money-day" data-today={i === week.today || undefined}>
          <i style={{ height: `${Math.max(MIN_BAR_PERCENT, (paise / most) * FULL_PERCENT)}%` }} />
          <small>{week.names[i]}</small>
        </span>
      ))}
    </div>
  );
}

/**
 * The head of the Money and Pay tabs (designs W15, H13) as the hero card: on light beige with two Warli figures faint
 * in its corner, what it is, the one big amount, what came today and how many, and for a worker the week as bars; then
 * two small tiles. The big line is the screen's heading, as it is the first thing the owner comes to the tab for.
 */
export function MoneyHead({ paise, label, aside, today, week, stats }: Props) {
  return (
    <div className="money-top">
      <div className="money-hero">
        <h1 className="money-head">
          <span className="money-label">{label}</span> <b className="money-big">{money(paise)}</b>
          {(today || aside) && (
            <span className="money-aside">
              {today && <span className="money-today">{today}</span>}
              {aside && (
                <span>
                  {today ? "" : PARTS.trim()}
                  {aside}
                </span>
              )}
            </span>
          )}
        </h1>
        {week && <Bars week={week} />}
      </div>
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
