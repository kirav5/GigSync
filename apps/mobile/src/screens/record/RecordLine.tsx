import type { JobRecord } from "@gigsync/core";
import type { EngagementId } from "@gigsync/protocol";
import { useId } from "react";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { requestWork } from "../../ui/work.js";
import type { JobActionProps } from "../JobActions.js";
import { JobThread } from "../JobThread.js";
import type { Chip } from "./text.js";
import "./record.css";

/** What a row needs to open the job's own card in place: the same as a card on Activity. */
export type CardProps = Omit<JobActionProps, "job">;

/** Which row is open, and how to open or close one: one at a time across the whole tab. */
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
  /** The money is in: received by the worker, or paid and confirmed for the household. The amount reads green. */
  settled: boolean;
  chip: Chip;
  /** Facts beside the chip: how the money came, its UPI reference. */
  facts?: readonly string[];
  open: boolean;
  onToggle: () => void;
}

/** Between the pieces of a row's description, so a screen reader pauses where the eye sees a new column. */
const PAUSE = ", ";
/** Between the work and its day on the row's second line. */
const PARTS = " · ";
const SETTLED = "record-price settled";
const PRICE = "record-price";

/**
 * One job in the record (designs W15, H13): the other side as a round initial, their name over the work and its day,
 * the signed price at the end, and where its money stands as a chip under them. The whole line is one button that
 * opens the job's own card (its thread and money actions) right under it. The button is named by what it does; the
 * row's words, joined with pauses, are its description, so a screen reader hears both.
 */
export function RecordLine({ job, when, who, price, settled, chip, facts = [], open, onToggle, ...card }: Props) {
  const { t } = useI18n();
  const id = useId();
  const about = `${id}-about`;
  const panel = `${id}-job`;
  const trade = requestWork(t, job.request);
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
        <Avatar name={who} size={AvatarSize.md} tone={AvatarTone.rust} />
        <span className="record-text">
          <strong className="record-who">{who}</strong>
          <span className="record-trade">
            {trade}
            {PARTS}
            <span className="record-day">{when}</span>
          </span>
          <span className="record-state">
            <span className={chip.cls}>{chip.text}</span>
            {facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </span>
        </span>
        <strong className={`${C.money} ${settled ? SETTLED : PRICE}`}>{money(price)}</strong>
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
