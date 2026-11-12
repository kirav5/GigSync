import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import type { GigView } from "../../useGig.js";
import { namesText, themOf } from "../activity/jobWords.js";

/** Between the count and the names. */
const DOT = " · ";

/**
 * The one thing on Home that interrupts (design W7): a dark line saying how many decisions wait and on whose jobs,
 * which opens the Jobs tab, where they are answered. Nothing at all while nothing waits.
 */
export function NeedsBanner({ view, onJobs }: { view: GigView; onJobs: () => void }) {
  const { lang, t, plural } = useI18n();
  const waiting = view.tasks.length + view.offers.length;
  if (waiting === 0) return null;
  const jobs = new Map(view.jobs.map((j) => [j.engagement.id, j]));
  const names = [
    ...new Set(
      view.tasks.flatMap((k) => {
        const job = jobs.get(k.engagement);
        return job ? [themOf(job, view.names, t)] : [];
      }),
    ),
  ];
  const who = names.length > 0 ? namesText(lang, names) : "";
  return (
    <button type={C.button} className="needs-banner" onClick={onJobs}>
      <span className="needs-dot" aria-hidden="true" />
      <span className="needs-words">{[plural("shell.need_you", waiting), who].filter(Boolean).join(DOT)}</span>
      <Icon name="chev" size={18} />
    </button>
  );
}
