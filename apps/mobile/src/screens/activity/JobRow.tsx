import type { JobRecord } from "@gigsync/core";
import { useId } from "react";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import type { GigView } from "../../useGig.js";
import { JobThread } from "../JobThread.js";
import type { CardProps } from "./JobLists.js";
import { type RowWords, rowWords, themOf } from "./jobWords.js";
import "./activity.css";

/** What a row reads from the phone: the other side's name, and the line and end word its job has now. */
function useRow(job: JobRecord, view: GigView, today: boolean): { name: string; words: RowWords } {
  const i18n = useI18n();
  return {
    name: themOf(job, view.names, i18n.t),
    words: rowWords(i18n, job, { tasks: view.tasks, payments: view.payments, today }),
  };
}

/** The row's face: the person's tile, their name over the work and where it stands, and the word at the end. */
function Face({ id, name, words }: { id: string; name: string; words: RowWords }) {
  return (
    <>
      <Avatar name={name} size={AvatarSize.md} tone={AvatarTone.rust} />
      <span className="job-row-text">
        <span id={`${id}n`} className="job-row-name">
          {name}
        </span>
        <span id={`${id}l`} className="job-row-line">
          {words.line}
        </span>
      </span>
      <span id={`${id}w`} className={`job-row-word ${words.tone}`}>
        {words.word}
      </span>
    </>
  );
}

/** A row is named by the person alone, so it is found by name however its line reads; the rest describes it. */
const named = (id: string) => ({ "aria-labelledby": `${id}n`, "aria-describedby": `${id}l ${id}w` });

interface RowProps extends CardProps {
  job: JobRecord;
  /** Signed work for today: a worker who has not set off is asked "On the way?". */
  today?: boolean;
  open: boolean;
  onToggle: () => void;
}

/**
 * One job on the Jobs tab as a single line (the design's jobRow), which opens the job's whole card right under it, in
 * place, as a Records row does: the decision, the deal, the contact and the money are all inside the card.
 */
export function JobRow({ job, today = false, open, onToggle, ...card }: RowProps) {
  const id = useId();
  const { name, words } = useRow(job, card.view, today);
  const panel = `${id}p`;
  return (
    <li>
      <button
        type={C.button}
        className="job-row"
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
        onClick={onToggle}
        {...named(id)}
      >
        <Face id={id} name={name} words={words} />
        <span className="job-row-chev" aria-hidden="true">
          <Icon name="chev_down" size={18} />
        </span>
      </button>
      {open && (
        <div id={panel} className="job-row-open">
          <JobThread job={job} {...card} />
        </div>
      )}
    </li>
  );
}

/** The same line on Home, where a tap opens the Jobs tab instead: the job's card and its moves live there. */
export function JobGlance({
  job,
  view,
  today = false,
  onOpen,
}: {
  job: JobRecord;
  view: GigView;
  today?: boolean;
  onOpen: () => void;
}) {
  const id = useId();
  const { name, words } = useRow(job, view, today);
  return (
    <li>
      <button type={C.button} className="job-row" onClick={onOpen} {...named(id)}>
        <Face id={id} name={name} words={words} />
        <span className="job-row-chev" aria-hidden="true">
          <Icon name="chev" size={18} />
        </span>
      </button>
    </li>
  );
}
