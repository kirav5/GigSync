import { log } from "@gigsync/core";
import { coarsePoint, MAX_ADDRESSES, type Place } from "@gigsync/protocol";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { homeCity } from "../../adapters/cities.js";
import { placesAt } from "../../adapters/geo.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { PlaceMap } from "../../ui/PlaceMap.js";
import { AddressFields, F, FIELDS, LabelChips, NearestArea } from "./AddressFields.js";
import type { AddressFormProps } from "./AddressForm.js";
import { LocateStep } from "./LocateStep.js";
import { PlaceSearch } from "./PlaceSearch.js";
import { NEAR, NOT_SERVED, PointFrom, useAddressDraft } from "./useAddressDraft.js";

/** Smaller than this, in degrees, the map has not moved: a jump to the same point, not the owner's hand. */
const STILL = 1e-6;
const moved = (a: Place, b: Place) => Math.abs(a.lat - b.lat) > STILL || Math.abs(a.lon - b.lon) > STILL;
const sameCell = (a: Place, b: Place) => {
  const [x, y] = [coarsePoint(a), coarsePoint(b)];
  return x.lat === y.lat && x.lon === y.lon;
};
/** The one field shown is the door's; the rest of the address waits behind "More details". */
const DOOR_FIELD = [F.house] as const;
const MORE_FIELDS = FIELDS.filter((f) => f !== F.house);
const DOOR_LABEL = { [F.house]: "addr.door_field" } as const;

/**
 * The door pin (app-journey S9, ADR 0050 §7): the map first, opened on the owner's city, with the pin fixed in the
 * middle; the owner slides it onto the door (or starts from their location or a search), and the place under the pin
 * fills the area, city and PIN, asked of the geocoder on its coarse grid (ADR 0045). Then one field for the flat, the
 * label, and "This is my door". The rest of the address is behind "More details", opened by itself when the map
 * cannot name the place. A map that never moved is not a door: the typed area places the pin, for the owner to check.
 */
export function DoorPin({ session, storage, onSaved, onCancel, locateFirst = false }: AddressFormProps) {
  const { t } = useI18n();
  const draft = useAddressDraft(session, storage, onSaved);
  const { values, spot, setSpot, problem, cities } = draft;
  const [mapShown, setMapShown] = useState(false);
  const [checking, setChecking] = useState(false);
  const [more, setMore] = useState(false);
  const moreId = useId();
  /** The last point the geocoder named. */
  const named = useRef<Place | undefined>(undefined);

  const centre = cities?.find((c) => c.key === homeCity())?.centre ?? cities?.[0]?.centre;
  useEffect(() => {
    if (centre && !spot) setSpot({ at: centre, from: PointFrom.seed });
  }, [centre, spot, setSpot]);

  const placed = (at: Place) => {
    named.current = at;
    setChecking(false);
  };

  async function onMove(at: Place) {
    if (spot && !moved(at, spot.at)) return;
    setSpot({ at, from: PointFrom.moved });
    setChecking(false);
    if (!draft.isServed(at)) return draft.setProblem(NOT_SERVED);
    draft.setProblem(undefined);
    if (named.current && sameCell(named.current, at)) return;
    named.current = at;
    try {
      const [place] = await placesAt(session, at);
      if (place) draft.fillFrom(place, at);
      else setMore(true);
    } catch (err) {
      // Geocoding off or failing: the owner types the area, city and PIN themselves.
      log.warn("naming the pinned place failed", { error: err instanceof Error ? err.name : typeof err });
      setMore(true);
    }
  }

  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!draft.pinOk()) return setMore(true);
    void draft.saving(async () => {
      if (!spot || spot.from === PointFrom.seed) {
        const at = await draft.placeTyped();
        if (!at) return draft.setProblem(NEAR);
        if (!draft.isServed(at)) return draft.setProblem(NOT_SERVED);
        setSpot({ at, from: PointFrom.typed });
        return setChecking(true);
      }
      if (!draft.isServed(spot.at)) return draft.setProblem(NOT_SERVED);
      if (!(await draft.store(spot.at, spot.from === PointFrom.phone || mapShown))) setMore(true);
    });
  }

  const place = draft.found && [draft.found, values.city].filter(Boolean).join(", ");
  return (
    <form className={`${C.card} door-pin`} aria-label={t("addr.add")} onSubmit={save} noValidate>
      <h2 className="door-title">{t("addr.door_title")}</h2>
      <p className={C.muted}>{t("addr.door_hint")}</p>
      {spot && (
        <PlaceMap
          at={spot.at}
          label={t("map.of", { place: draft.found ?? (values.area || values.city) })}
          onMove={(at) => void onMove(at)}
          onShown={() => setMapShown(true)}
        />
      )}
      {place && (
        <p className="door-place" role="status">
          <Icon name="pin" size={16} />
          {place}
        </p>
      )}
      {checking && mapShown && (
        <p className={C.muted} role="status">
          {t("addr.check_pin")}
        </p>
      )}
      {problem === NOT_SERVED && (
        <p className={C.error} role="alert">
          {t(NOT_SERVED)}
        </p>
      )}
      <div className="door-find">
        <LocateStep
          session={session}
          onFound={(p, at) => draft.fillFrom(p, at, PointFrom.phone) && placed(at)}
          precise
          asked={locateFirst}
        />
        <PlaceSearch
          session={session}
          onPick={(p) => draft.fillFrom(p, p.point, PointFrom.search) && placed(p.point)}
        />
      </div>
      <AddressFields fields={DOOR_FIELD} values={values} onChange={draft.set} required={false} labels={DOOR_LABEL} />
      <LabelChips label={draft.label} onPick={draft.setLabel} />
      <button
        type={C.button}
        className="btn quiet door-more"
        aria-expanded={more}
        aria-controls={moreId}
        onClick={() => setMore(!more)}
      >
        {t("addr.more")}
        <Icon name="chev_down" size={16} />
      </button>
      <div id={moreId} className="door-more-fields" hidden={!more}>
        <AddressFields fields={MORE_FIELDS} values={values} onChange={draft.set} required={false} />
      </div>
      {problem && problem !== NOT_SERVED && (
        <p className={C.error} role="alert">
          {t(problem, { max: MAX_ADDRESSES })}
        </p>
      )}
      {problem === NEAR && (
        <NearestArea
          onPick={(a) => {
            setSpot({ at: { lat: a.lat, lon: a.lon }, from: PointFrom.typed });
            setChecking(true);
            draft.setProblem(undefined);
          }}
        />
      )}
      <p className="fine">{t("addr.door_note")}</p>
      <div className="door-actions">
        <button type={C.submit} className={`${C.wide} btn-big`} disabled={draft.busy} aria-busy={draft.busy}>
          <Icon name="tick" />
          {t("addr.door_save")}
        </button>
        <button type={C.button} className="btn quiet wide" onClick={onCancel}>
          {t("addr.cancel")}
        </button>
      </div>
    </form>
  );
}
