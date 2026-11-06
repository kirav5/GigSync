import { log, type MessageKey } from "@gigsync/core";
import { GEO_QUERY_MIN, type GeoPlace, type Session } from "@gigsync/protocol";
import { type KeyboardEvent, useState } from "react";
import { geocodingOff, placesNamed } from "../../adapters/geo.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const ENTER = "Enter";

/**
 * The search fallback (ADR 0045): the owner types their area or building and presses Search (one lookup per press,
 * never per letter), then taps the place that is theirs. Nothing found, or search not set up, says to type the
 * address below.
 */
export function PlaceSearch({ session, onPick }: { session: Session; onPick: (place: GeoPlace) => void }) {
  const { t } = useI18n();
  const [places, setPlaces] = useState<GeoPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<MessageKey>();
  const [query, setQuery] = useState("");

  async function search() {
    const q = query.trim();
    if (q.length < GEO_QUERY_MIN) return;
    setBusy(true);
    setNote(undefined);
    try {
      const found = await placesNamed(session, q);
      setPlaces(found);
      if (found.length === 0) setNote("addr.search_none");
    } catch (err) {
      log.warn("place search failed", { error: err instanceof Error ? err.name : typeof err });
      setNote(geocodingOff(err) ? "addr.search_off" : "addr.search_none");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={C.stack}>
      {/* Not a form: it sits inside the address form, and Enter here searches rather than saving. */}
      <search className={C.row}>
        <input
          className={C.field}
          type="search"
          value={query}
          placeholder={t("addr.search")}
          aria-label={t("addr.search")}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== ENTER) return;
            e.preventDefault();
            void search();
          }}
        />
        <button
          type={C.button}
          className={C.secondaryCompact}
          disabled={busy}
          aria-busy={busy}
          onClick={() => void search()}
        >
          {t("addr.find")}
        </button>
      </search>
      {places.map((p) => (
        <button key={p.label} type={C.button} className={C.chip} onClick={() => onPick(p)}>
          {p.label}
        </button>
      ))}
      {note && (
        <p className={C.muted} role="status">
          {t(note)}
        </p>
      )}
    </div>
  );
}
