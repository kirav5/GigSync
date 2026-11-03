import { localitySlug, nearestPilotArea } from "@gigsync/core";
import { coarsePoint, type GeoPlace, type Place, type Session } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AREAS } from "../../ui/places.js";
import { LocateStep } from "../address/LocateStep.js";

/** How far a worker may say they go, in km (ADR 0045). */
export const RADII_KM = [3, 5, 10, 25] as const;

/** The worker's area: a pilot area's key, or a place they found with their location (its name and coarse point). */
export interface WorkArea {
  area: string | undefined;
  place?: { name: string; lat: number; lon: number } | undefined;
  radius_km: number;
}

/**
 * Where a worker works from and how far they go (ADR 0045): a pilot area from the list, or "Use my location", which
 * names their locality from a coarse point (or, when the server cannot name places, the pilot area that point is in,
 * keeping the point itself); and a radius. Only the coarse point goes on the board.
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
  const found = (place: GeoPlace, point: Place) => {
    const at = coarsePoint(point);
    const key = localitySlug(place.locality);
    if (key) onChange({ ...value, area: key, place: { name: place.locality, ...at } });
  };
  /** No place names from the server: the pilot area the phone is in, at the phone's own coarse point. */
  const nearby = (point: Place): boolean => {
    const pilot = nearestPilotArea(point);
    if (pilot) onChange({ ...value, area: pilot.key, place: { name: pilot.name, ...coarsePoint(point) } });
    return pilot !== undefined;
  };
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
      <LocateStep session={session} onFound={found} onPointOnly={nearby} label="card.use_location" />
      {value.place && (
        <p className={C.muted} role="status">
          {t("card.area_found", { area: value.place.name })}
        </p>
      )}
      <fieldset className={C.row} aria-label={t("card.radius")}>
        <span className={C.muted}>{t("card.radius")}</span>
        {RADII_KM.map((km) => (
          <button
            key={km}
            type={C.button}
            aria-pressed={value.radius_km === km}
            className={value.radius_km === km ? C.chipOn : C.chip}
            onClick={() => onChange({ ...value, radius_km: km })}
          >
            {t("card.km", { km })}
          </button>
        ))}
      </fieldset>
    </div>
  );
}
