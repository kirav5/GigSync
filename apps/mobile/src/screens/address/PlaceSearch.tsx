import type { GeoPlace, Place, Session } from "@gigsync/protocol";
import { type KeyboardEvent, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { usePlaceSearch } from "./usePlaceSearch.js";
import "./address.css";

const ENTER = "Enter";
/** The field's type, its glass and the key the phone's keyboard shows to press. */
const SEARCH = "search";
/** A found place's line is split at its first comma: the place itself in bold, the rest of the address muted under it. */
const LINE_PART = ", ";
/** A part of the line that is only a house number ("1090"): no name for the place on its own. */
const NUMBER_ONLY = /^[\d\s/-]+$/;

/** What the box keeps once a place is picked: its first part that names something, else its locality. */
const pickedName = (place: GeoPlace): string =>
  place.label.split(LINE_PART).find((part) => !NUMBER_ONLY.test(part.trim())) ?? place.locality;

/**
 * The places search (ADR 0045): the owner types their area or building and the places that match show under the box
 * as they pause (Enter or the arrow looks up at once), favouring the city around `near`; they tap the one that is
 * theirs. Nothing found, or search not set up, says to type the address below.
 */
export function PlaceSearch({
  session,
  near,
  onPick,
}: {
  session: Session;
  /** Where to look first: the centre of the city in use, or the worker's area; never the owner's own fix. */
  near?: Place | undefined;
  onPick: (place: GeoPlace) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const { places, busy, note, type, now, clear } = usePlaceSearch(session, near);

  return (
    <div className={C.stack}>
      {/* Not a form: it sits inside the address form, and Enter here searches rather than saving. */}
      {/* One field, as a map app's: the glass inside it, Enter or the arrow at its end to search. */}
      <search className="place-search">
        <Icon name={SEARCH} size={20} />
        <input
          className={C.field}
          type={SEARCH}
          enterKeyHint={SEARCH}
          value={query}
          placeholder={t("addr.search")}
          aria-label={t("addr.search")}
          autoComplete="off"
          aria-autocomplete="list"
          onChange={(e) => {
            setQuery(e.target.value);
            type(e.target.value);
          }}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== ENTER) return;
            e.preventDefault();
            now(query);
          }}
        />
        <button
          type={C.button}
          className="place-search-go"
          disabled={busy}
          aria-busy={busy}
          aria-label={t("addr.find")}
          onClick={() => now(query)}
        >
          {!busy && <Icon name="arrow" size={20} />}
        </button>
      </search>
      {places.length > 0 && (
        <ul className="place-results">
          {places.map((p) => {
            const [head, ...rest] = p.label.split(LINE_PART);
            return (
              <li key={p.label}>
                <button
                  type={C.button}
                  className="place-result"
                  onClick={() => {
                    clear();
                    setQuery(pickedName(p));
                    onPick(p);
                  }}
                >
                  <Icon name="pin" size={18} />
                  <span>
                    <strong>{head}</strong>
                    <span className="place-rest">{rest.join(LINE_PART)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {note && (
        <p className={C.muted} role="status">
          {t(note)}
        </p>
      )}
    </div>
  );
}
