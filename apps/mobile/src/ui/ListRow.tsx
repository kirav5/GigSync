import { type ReactNode, useId } from "react";
import { C } from "./cls.js";
import { Icon, type IconName } from "./Icon.js";

/** How a row's icon tile is coloured: rust on sage (the usual), a green icon, a done tile (green, ivory tick), muted. */
export const RowTone = { rust: "rust", green: "green", done: "done", muted: "muted" } as const;
export type RowTone = (typeof RowTone)[keyof typeof RowTone];

const ROW = "list-row";
const CURRENT = "page";

interface RowProps {
  icon?: IconName | undefined;
  /** The row's accessible name, exactly: what a test or a reader selects it by. */
  title: string;
  sub?: ReactNode;
  /** A short value at the end of the row ("On", "64 days"). */
  end?: ReactNode;
  /** Makes the row a button, with a chevron at its end. */
  onClick?: (() => void) | undefined;
  /** One more element that describes the row, such as a count beside it. */
  describedById?: string | undefined;
  /** The row for the screen now open (aria-current="page"). */
  current?: boolean | undefined;
  tone?: RowTone | undefined;
}

/**
 * One row of a list card (the design's li): a 40px sage tile with the icon, the title over its line, an optional value
 * and, when it opens something, a chevron. As a button its name is the title alone (aria-labelledby); the line and the
 * value are its description, so a row is found by its exact title however the line under it reads.
 */
export function ListRow({
  icon,
  title,
  sub,
  end,
  onClick,
  describedById,
  current = false,
  tone = RowTone.rust,
}: RowProps) {
  const id = useId();
  const titleId = `${id}t`;
  const subId = `${id}s`;
  const endId = `${id}e`;
  const body = (
    <>
      {icon && (
        <span className={`list-row-icon ${tone}`}>
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className="list-row-text">
        <span id={titleId} className="list-row-title">
          {title}
        </span>
        {sub && (
          <span id={subId} className="list-row-sub">
            {sub}
          </span>
        )}
      </span>
      {end && (
        <span id={endId} className="list-row-end">
          {end}
        </span>
      )}
      {onClick && (
        <span className="list-row-chev">
          <Icon name="chev" size={18} />
        </span>
      )}
    </>
  );
  if (!onClick) return <div className={ROW}>{body}</div>;
  const described = [sub ? subId : undefined, end ? endId : undefined, describedById].filter(Boolean).join(" ");
  return (
    <button
      type={C.button}
      className={ROW}
      aria-labelledby={titleId}
      aria-describedby={described || undefined}
      aria-current={current ? CURRENT : undefined}
      onClick={onClick}
    >
      {body}
    </button>
  );
}

/**
 * Rows in one card with hairlines between them. With `label`, the small uppercase line above names the group for a
 * reader too (a section labelled by it).
 */
export function ListCard({ label, children }: { label?: string | undefined; children: ReactNode }) {
  const id = useId();
  const card = <div className="list-card">{children}</div>;
  if (!label) return card;
  return (
    <section className="list-group" aria-labelledby={id}>
      <p id={id} className="section-label">
        {label}
      </p>
      {card}
    </section>
  );
}
