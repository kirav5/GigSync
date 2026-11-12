import { type ReactNode, useId } from "react";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";

const ROW = "list-row";

interface Props {
  /** Who the row is about: its title, and its accessible name as a button. */
  name: string;
  sub?: ReactNode;
  /** A short value or an action at the end ("Needs you", Ask again). */
  end?: ReactNode;
  /** Makes the whole row a button, with a chevron. */
  onClick?: (() => void) | undefined;
}

/**
 * A row about a person (the design's jobRow): their initial on a rust disc, their name over a line, and an end. As
 * ui/ListRow.tsx does for a row with an icon, a button row is named by the name alone and described by the rest.
 */
export function PersonRow({ name, sub, end, onClick }: Props) {
  const id = useId();
  const nameId = `${id}n`;
  const subId = `${id}s`;
  const endId = `${id}e`;
  const body = (
    <>
      <Avatar name={name} size={AvatarSize.md} tone={AvatarTone.rust} />
      <span className="list-row-text">
        <span id={nameId} className="list-row-title">
          {name}
        </span>
        {sub && (
          <span id={subId} className="list-row-sub">
            {sub}
          </span>
        )}
      </span>
      {end && (
        <span id={endId} className="list-row-end person-row-end">
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
  const described = [sub ? subId : undefined, end ? endId : undefined].filter(Boolean).join(" ");
  return (
    <button
      type={C.button}
      className={ROW}
      aria-labelledby={nameId}
      aria-describedby={described || undefined}
      onClick={onClick}
    >
      {body}
    </button>
  );
}
