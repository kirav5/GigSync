import type { JobRecord } from "@gigsync/core";
import type { EngagementId } from "@gigsync/protocol";
import { useId } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import type { JobActionProps } from "../JobActions.js";
import { JobThread } from "../JobThread.js";
import type { Chip } from "./text.js";
import "./record.css";

/** What a row needs to open the job's own card in place: the same as a card on Today. */
export type CardProps = Omit<JobActionProps, "job">;

/** Which row is open, and how to open or close one: one at a time across the whole of Passbook. */
export interface OpenRow {
  openId: EngagementId | undefined;
  onToggle: (id: EngagementId) => void;
}

interface Props extends CardProps {
  job: JobRecord;
  /** The day, already in the owner's words. */
  when: string;
  /** The other side's name. */
  who: string;
  /** The signed price, in paise. */
  price: number;
  chip: Chip;
  /** Facts beside the chip: how the money came, its UPI reference. */
  facts?: readonly string[];
  open: boolean;
  onToggle: () => void;
}

/** Between the pieces of a row's description, so a screen reader pauses where the eye sees a new column. */
const PAUSE = ", ";

/**
 * One job in the record: day, name, trade, the signed price and where its money stands. The whole line is one 48px
 * button that opens the job's own card (its thread and money actions) right under it. The button is named by what
 * it does; the row's words, joined with pauses, are its description, so a screen reader hears both.
 */
export function RecordLine({ job, when, who, price, chip, facts = [], open, onToggle, ...card }: Props) {
  const { t } = useI18n();
  const id = useId();
  const about = `${id}-about`;
  const panel = `${id}-job`;
  const trade = t(`trade.${job.request.trade}`);
  return (
    <li>
      <button
        type={C.button}
        className="record-line"
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
        aria-label={t(open ? "record.close" : "record.open")}
        aria-describedby={about}
        onClick={onToggle}
      >
        <span className="record-text">
          <span className="record-day">{when}</span>
          <strong className="record-who">{who}</strong>
          <strong className={`${C.money} record-price`}>{money(price)}</strong>
          <span className="record-trade">{trade}</span>
          <span className="record-state">
            <span className={chip.cls}>{chip.text}</span>
            {facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </span>
        </span>
        <span className="record-chevron" aria-hidden="true" />
      </button>
      <span id={about} hidden>
        {[when, who, trade, money(price), chip.text, ...facts].join(PAUSE)}
      </span>
      {open && (
        <div id={panel} className="record-job">
          <JobThread job={job} {...card} />
        </div>
      )}
    </li>
  );
}
