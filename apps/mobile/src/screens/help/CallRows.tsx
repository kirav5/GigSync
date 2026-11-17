import { type ReactNode, useId, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { ListCard } from "../../ui/ListRow.js";
import "./calls.css";

const TEL = "tel:";
const SPACES = /\s+/g;

/** One number to call: its name as shown (a guide's may carry its "as written" toggle), the name as text, the number. */
export interface CallLine {
  name: ReactNode;
  /** The name as plain words, for the row's accessible name. */
  said: string;
  number: string;
}

function CallRow({ line, at }: { line: CallLine; at: number }) {
  const { t } = useI18n();
  return (
    <a
      className="list-row call-row"
      href={`${TEL}${line.number.replace(SPACES, "")}`}
      aria-label={t("landing.call", { name: line.said, number: line.number })}
      style={{ "--at": at } as React.CSSProperties}
    >
      <span className="list-row-icon">
        <Icon name="call" size={20} />
      </span>
      <span className="list-row-text">
        <span className="list-row-title">{line.name}</span>
        <span className="list-row-sub call-number">{line.number}</span>
      </span>
    </a>
  );
}

/**
 * Numbers as rows of one list card, each a tap to call: the phone tile, the name, and the number under it. Help, the
 * moving journey and a city with no guide all draw their numbers with this, so they read the same everywhere. With
 * `folded`, a long list waits behind one row and slides open on a tap, so it does not crowd the page.
 */
export function CallRows({
  label,
  lines,
  folded = false,
}: {
  label: string;
  lines: readonly CallLine[];
  folded?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const id = useId();
  if (lines.length === 0) return null;
  const rows = lines.map((line, at) => <CallRow key={line.number} line={line} at={at} />);
  if (!folded) return <ListCard label={label}>{rows}</ListCard>;
  return (
    <ListCard label={label}>
      <button
        type={C.button}
        className="list-row call-fold"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="list-row-icon">
          <Icon name="call" size={20} />
        </span>
        <span className="list-row-text">
          <span className="list-row-title">{t("landing.lines_title")}</span>
          <span className="list-row-sub">{t("landing.lines_count", { count: String(lines.length) })}</span>
        </span>
        <span className="list-row-chev call-fold-chev">
          <Icon name="chev" size={18} />
        </span>
      </button>
      <div id={id} className="call-fold-body" data-open={open || undefined} inert={!open}>
        <div className="call-fold-rows">{rows}</div>
      </div>
    </ListCard>
  );
}
