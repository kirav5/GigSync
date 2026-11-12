import { type ReactNode, useId } from "react";
import { useI18n } from "../../i18n.js";
import { monthText } from "./text.js";
import "./record.css";

/** One month's small heading, in the owner's language, over its rows in one card: the list is named by the month. */
export function MonthGroup({ month, children }: { month: string; children: ReactNode }) {
  const { lang } = useI18n();
  const heading = useId();
  return (
    <div className="record-month">
      <h3 id={heading}>{monthText(lang, month)}</h3>
      <ul className="record-list" aria-labelledby={heading}>
        {children}
      </ul>
    </div>
  );
}
