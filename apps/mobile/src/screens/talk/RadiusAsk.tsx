import { ASKED_RADIUS_KM, type CardDraft, RADII_KM } from "@gigsync/core";
import { useState } from "react";
import { tapInterview } from "../../card/interviewStore.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AREAS } from "../../ui/places.js";
import { RadiusMap } from "../../ui/RadiusMap.js";

/**
 * Under "How far will you go for work?", the way Hinge sets a maximum distance: the map of the area just answered with
 * its circle and the slider (the same as My card's), starting at 10 km, the 5 and 10 km chips that set the slider (and
 * so the circle) at once, and a button that answers with the distance set. Only the button answers.
 */
export function RadiusAsk({ draft }: { draft: CardDraft }) {
  const { t } = useI18n();
  const [km, setKm] = useState(draft.radius_km ?? ASKED_RADIUS_KM);
  // A pilot area's centre, or the place found with their location; the first pilot area if neither is known.
  const area = AREAS.find((a) => a.key === draft.area) ?? AREAS[0];
  const label = t("cardflow.use_km", { km });
  return (
    <div className={`${C.stack} iv-radius`}>
      <RadiusMap
        at={draft.place ?? { lat: area.lat, lon: area.lon }}
        name={draft.place?.name ?? t(`area.${area.key}`)}
        km={km}
        onKm={setKm}
      />
      <div className={C.row}>
        {RADII_KM.map((quick) => (
          <button
            key={quick}
            type={C.button}
            aria-pressed={km === quick}
            className={km === quick ? C.chipOn : C.chip}
            onClick={() => setKm(quick)}
          >
            {t("card.km", { km: quick })}
          </button>
        ))}
      </div>
      <button type={C.button} className={C.accent} onClick={() => tapInterview(String(km), label)}>
        {label}
      </button>
    </div>
  );
}
