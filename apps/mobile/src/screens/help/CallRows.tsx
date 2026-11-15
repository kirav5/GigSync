import type { ReactNode } from "react";
import { useI18n } from "../../i18n.js";
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

/**
 * Numbers as rows of one list card, each a tap to call: the phone tile, the name, and the number under it. Help, the
 * moving journey and a city with no guide all draw their numbers with this, so they read the same everywhere.
 */
export function CallRows({ label, lines }: { label: string; lines: readonly CallLine[] }) {
  const { t } = useI18n();
  if (lines.length === 0) return null;
  return (
    <ListCard label={label}>
      {lines.map((line) => (
        <a
          key={line.number}
          className="list-row call-row"
          href={`${TEL}${line.number.replace(SPACES, "")}`}
          aria-label={t("landing.call", { name: line.said, number: line.number })}
        >
          <span className="list-row-icon">
            <Icon name="call" size={20} />
          </span>
          <span className="list-row-text">
            <span className="list-row-title">{line.name}</span>
            <span className="list-row-sub call-number">{line.number}</span>
          </span>
        </a>
      ))}
    </ListCard>
  );
}
