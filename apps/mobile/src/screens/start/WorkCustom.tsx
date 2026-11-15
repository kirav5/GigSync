import { closestKinds } from "@gigsync/core";
import type { WorkKind } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { Chips, type Picking } from "./WorkChips.js";
import { ownWorkOf } from "./workKinds.js";

/** The work a worker added in their own words, and adding and taking it off. */
export interface OwnWork {
  words: readonly string[];
  onAdd: (words: string) => void;
  onRemove: (words: string) => void;
}

/**
 * Under a search: the words typed or said as their own chip ("Add “i sharpen wood”"), for work the list does not name,
 * and the kinds closest to them ("Closest: Carpenter") that the search itself did not find, so a worker can take the
 * nearest kind at once. The card chat asks about the words against the same kinds.
 */
export function OwnWorkAdd({
  query,
  found,
  pick,
  own,
}: {
  query: string;
  found: readonly WorkKind[];
  pick: Picking;
  own: OwnWork;
}) {
  const { t, lang } = useI18n();
  const words = ownWorkOf(query, lang);
  if (!words) return null;
  const closest = closestKinds(words).filter((k) => !found.includes(k));
  const added = own.words.includes(words);
  return (
    <>
      <ul className="work-chips">
        <li>
          <button
            type={C.button}
            className="work-chip work-add"
            aria-pressed={added}
            disabled={pick.full && !added}
            onClick={() => (added ? own.onRemove(words) : own.onAdd(words))}
          >
            <Icon name={added ? "tick" : "plus"} size={16} />
            {t("work.add", { words })}
          </button>
        </li>
      </ul>
      {closest.length > 0 && (
        <div className="work-closest">
          <span className={C.muted}>{t("work.closest")}</span>
          <Chips kinds={closest} pick={pick} />
        </div>
      )}
    </>
  );
}

/** The work added in the worker's own words, ticked, while the search shows something else; a tap takes one off. */
export function OwnWorkPicked({ own }: { own: OwnWork }) {
  const { t } = useI18n();
  if (own.words.length === 0) return null;
  return (
    <section className="work-group" aria-label={t("work.yours")}>
      <h2 className="work-group-title">{t("work.yours")}</h2>
      <ul className="work-chips">
        {own.words.map((words) => (
          <li key={words}>
            <button type={C.button} className="work-chip" aria-pressed onClick={() => own.onRemove(words)}>
              <Icon name="tick" size={16} />
              {words}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
