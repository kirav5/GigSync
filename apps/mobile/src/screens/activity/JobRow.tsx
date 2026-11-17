import type { JobRecord } from "@gigsync/core";
import { useId } from "react";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import type { GigView } from "../../useGig.js";
import { JobThread } from "../JobThread.js";
import type { CardProps } from "./JobLists.js";
import { doneWords, type RowWords, rowWords, themOf } from "./jobWords.js";
import "./activity.css";

/** The row's button: a compact card face, the same on the Jobs tab, under Done and on Home. */
const ROW = "job-row";

/** What a row reads from the phone: the other side's name, and the words its job has now. */
function useRow(job: JobRecord, view: GigView, day: string, today: boolean): { name: string; words: RowWords } {
  const i18n = useI18n();
  return {
    name: themOf(job, view.names, i18n.t),
    words: rowWords(i18n, job, { tasks: view.tasks, payments: view.payments, day, today }),
  };
}

/** Between the work and when it is, on the row's second line. */
const DOT = " · ";

/**
 * The row's face, as an order or a trip in a list: the person's tile; their name, and the work and when under it; the
 * amount at the end with the status pill under it (rust when the move is the owner's, green once paid).
 */
function Face({ id, name, words }: { id: string; name: string; words: RowWords }) {
  return (
    <>
      <Avatar name={name} size={AvatarSize.md} tone={AvatarTone.rust} />
      <span className="job-row-text">
        <span id={`${id}n`} className="job-row-name">
          {name}
        </span>
        <span className="job-row-line">
          <span id={`${id}l`}>{words.line}</span>
          {words.meta && (
            <>
              {DOT}
              <span id={`${id}m`}>{words.meta}</span>
            </>
          )}
        </span>
      </span>
      <span className="job-row-end">
        {words.amount && (
          <span id={`${id}a`} className={`job-row-amount ${words.tone}`}>
            {words.amount}
          </span>
        )}
        <span id={`${id}w`} className={`job-pill ${words.tone}`}>
          {words.word}
        </span>
      </span>
    </>
  );
}

/** A row is named by the person alone, so it is found by name however its words read; the rest describes it. */
function named(id: string, words: RowWords) {
  const parts = [`${id}l`, `${id}w`, words.meta && `${id}m`, words.amount && `${id}a`];
  return { "aria-labelledby": `${id}n`, "aria-describedby": parts.filter(Boolean).join(" ") };
}

interface RowProps extends CardProps {
  job: JobRecord;
  /** This phone's day ("YYYY-MM-DD"). */
  day: string;
  /** Signed work for today: a worker who has not set off is asked "On the way?". */
  today?: boolean;
  /** Under Needs you: the opened card leads with the decision, and the agents' talk is folded at its end. */
  decide?: boolean;
  open: boolean;
  onToggle: () => void;
}

/**
 * One job on the Jobs tab as a compact card, which opens the job's whole card right under it, in place, as a Records
 * row does: the decision, the deal, the contact and the money are all inside the card.
 */
export function JobRow({ job, day, today = false, decide = false, open, onToggle, ...card }: RowProps) {
  const id = useId();
  const { name, words } = useRow(job, card.view, day, today);
  const panel = `${id}p`;
  return (
    <li>
      <button
        type={C.button}
        className={ROW}
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
        onClick={onToggle}
        {...named(id, words)}
      >
        <Face id={id} name={name} words={words} />
      </button>
      {open && (
        <div id={panel} className="job-row-open">
          <JobThread job={job} foldTalk={decide} {...card} />
        </div>
      )}
    </li>
  );
}

/** A finished job under Done: where it ended and the price; a tap opens Money, where finished jobs are kept. */
export function DoneRow({ job, view, onOpen }: { job: JobRecord; view: GigView; onOpen: () => void }) {
  const id = useId();
  const i18n = useI18n();
  const name = themOf(job, view.names, i18n.t);
  const words = doneWords(i18n, job, view.payments);
  return (
    <li>
      <button type={C.button} className={ROW} onClick={onOpen} {...named(id, words)}>
        <Face id={id} name={name} words={words} />
      </button>
    </li>
  );
}
