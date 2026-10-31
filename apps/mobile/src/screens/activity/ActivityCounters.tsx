import { type ActivityCounts, ActivityTab, type MessageKey } from "@gigsync/core";
import { type KeyboardEvent, useRef } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import "./activity.css";

/** The three counters that are tabs, in collab's order; Closed follows them and opens Records instead. */
const TABS: readonly { tab: ActivityTab; label: MessageKey }[] = [
  { tab: ActivityTab.awaiting, label: "activity.tab_awaiting" },
  { tab: ActivityTab.talks, label: "activity.tab_talks" },
  { tab: ActivityTab.agreed, label: "activity.tab_agreed" },
];

/** Arrow keys move between tabs, as a tab list does everywhere else. */
const Step = { ArrowLeft: -1, ArrowRight: 1 } as const;
const isStepKey = (key: string): key is keyof typeof Step => Object.hasOwn(Step, key);

/** A tab's element id, and its panel's, under the frame's `base` id. */
export const tabId = (base: string, tab: ActivityTab) => `${base}-${tab}`;
export const panelId = (base: string) => `${base}-panel`;

interface Props {
  base: string;
  counts: ActivityCounts;
  shown: ActivityTab;
  onPick: (tab: ActivityTab) => void;
  /** Closed's counter: finished jobs live in Records only. */
  onRecords: () => void;
}

/**
 * Activity's four counters across the top, as collab's: Awaiting you, In talks and Agreed are tabs over one panel;
 * Closed counts finished jobs and opens Records. Each counter's name is its label; its number is its description.
 */
export function ActivityCounters({ base, counts, shown, onPick, onRecords }: Props) {
  const { t } = useI18n();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    if (!isStepKey(e.key)) return;
    e.preventDefault();
    const next = (index + Step[e.key] + TABS.length) % TABS.length;
    const target = TABS[next];
    if (!target) return;
    onPick(target.tab);
    tabs.current[next]?.focus();
  }

  return (
    <div className="radar">
      <div role="tablist" aria-label={t("activity.tabs")} className="radar-tabs">
        {TABS.map(({ tab, label }, index) => {
          const on = tab === shown;
          const id = tabId(base, tab);
          return (
            <button
              key={tab}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              id={id}
              type={C.button}
              role="tab"
              className={`radar-count ${tab}`}
              aria-selected={on}
              aria-controls={panelId(base)}
              aria-label={t(label)}
              aria-describedby={`${id}-n`}
              tabIndex={on ? 0 : -1}
              onClick={() => onPick(tab)}
              onKeyDown={(e) => onKeyDown(e, index)}
            >
              <b id={`${id}-n`}>{counts[tab]}</b>
              <span aria-hidden="true">{t(label)}</span>
            </button>
          );
        })}
      </div>
      <button
        type={C.button}
        className="radar-count closed"
        aria-label={t("activity.tab_closed")}
        aria-describedby={`${base}-closed-n`}
        onClick={onRecords}
      >
        <b id={`${base}-closed-n`}>{counts.closed}</b>
        <span aria-hidden="true">{t("activity.tab_closed")}</span>
      </button>
    </div>
  );
}
