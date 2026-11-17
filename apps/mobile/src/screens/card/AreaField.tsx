import { log } from "@gigsync/core";
import type { GeoPlace, Place, Session } from "@gigsync/protocol";
import { placesAt } from "../../adapters/geo.js";
import { pointOnlyPlace, workPlace } from "../../card/workPlace.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AREAS } from "../../ui/places.js";
import { RadiusMap } from "../../ui/RadiusMap.js";
import { LocateStep } from "../address/LocateStep.js";
import { PlaceSearch } from "../address/PlaceSearch.js";

/** The pilot area picked, or the first while none is. */
const areaOf = (key: string | undefined) => AREAS.find((a) => a.key === key) ?? AREAS[0];
const areaKey = (key: string | undefined) => areaOf(key).key;
/** A pilot area's centre, where the distance circle is drawn when no place was found by location. */
const areaPoint = (key: string | undefined) => ({ lat: areaOf(key).lat, lon: areaOf(key).lon });

/** The worker's area: a pilot area's key, or a place they found with their location (its name and coarse point). */
export interface WorkArea {
  area: string | undefined;
  place?: { name: string; lat: number; lon: number } | undefined;
  radius_km: number;
}

/**
 * Where a worker works from and how far they go (ADR 0045): a pilot area from the list, a place found by name, or
 * "Use my location", which names their locality from a coarse point (or, when the server cannot name places, the pilot
 * area that point is in, keeping the point itself); and a radius. Only the coarse point goes on the board.
 */
export function AreaField({
  session,
  value,
  onChange,
}: {
  session: Session;
  value: WorkArea;
  onChange: (next: WorkArea) => void;
}) {
  const { t } = useI18n();
  const located = (place: GeoPlace, point: Place) => {
    const found = workPlace(place, point);
    if (found) onChange({ ...value, ...found });
  };
  /** No place names from the server: the pilot area the phone is in, at the phone's own coarse point. */
  const nearby = (point: Place): boolean => {
    const found = pointOnlyPlace(point);
    if (found) onChange({ ...value, ...found });
    return found !== undefined;
  };
  /** Dragged on the map: the start point moves there at once, and takes the name of the place it landed in. */
  async function moved(at: Place) {
    if (!value.place) return;
    const here = { ...value, place: { ...value.place, lat: at.lat, lon: at.lon } };
    onChange(here);
    const [place] = await placesAt(session, at).catch((err: unknown) => {
      log.warn("naming the work area failed", { error: err instanceof Error ? err.name : typeof err });
      return [];
    });
    const found = place && workPlace(place, at);
    if (found) onChange({ ...here, area: found.area, place: { ...found.place, lat: at.lat, lon: at.lon } });
  }
  return (
    <div className={C.stack}>
      <label className={C.fieldLabel}>
        <span className={C.muted}>{t("card.where")}</span>
        <select
          className={C.field}
          value={value.area ?? ""}
          onChange={(e) => onChange({ ...value, area: e.target.value, place: undefined })}
        >
          {!value.area && (
            <option value="" disabled>
              {t("card.area_choose")}
            </option>
          )}
          {value.place && <option value={value.area}>{value.place.name}</option>}
          {AREAS.map((a) => (
            <option key={a.key} value={a.key}>
              {t(`area.${a.key}`)}
            </option>
          ))}
        </select>
      </label>
      <LocateStep session={session} onFound={located} onPointOnly={nearby} label="card.use_location" />
      {/* Or the place by name, as the address form finds one, looked for first around where they work now. */}
      <span className={C.muted}>{t("card.area_search")}</span>
      <PlaceSearch session={session} near={value.place ?? areaPoint(value.area)} onPick={(p) => located(p, p.point)} />
      {value.place && (
        <p className={C.muted} role="status">
          {t("card.area_found", { area: value.place.name })}
        </p>
      )}
      {/* How far they go, as Hinge sets a maximum distance: a circle on the map of their area, a slider under it. The
          same map is where they start from (ADR 0050 §7): dragging it moves the point; the board still gets only its
          coarse rounding. */}
      <RadiusMap
        onMove={value.place && ((at) => void moved(at))}
        at={value.place ?? areaPoint(value.area)}
        name={value.place?.name ?? t(`area.${areaKey(value.area)}`)}
        km={value.radius_km}
        onKm={(radius_km) => onChange({ ...value, radius_km })}
      />
    </div>
  );
}
