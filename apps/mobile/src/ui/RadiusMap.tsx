import { MAX_RADIUS_KM, type Place } from "@gigsync/protocol";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { openMap } from "../adapters/map.js";
import { useI18n } from "../i18n.js";
import { C } from "./cls.js";
import { circleBounds, circleFeature } from "./radiusCircle.js";
import "./radius.css";

const SOURCE = "gigsync-radius";
const FILL = "gigsync-radius-fill";
const LINE = "gigsync-radius-line";
/** The circle in the UI kit's terracotta: a soft fill and a firm edge. */
const ACCENT = "#a4512b";
const FILL_OPACITY = 0.14;
const LINE_WIDTH = 2;
/** Room around the circle when the map fits it, in pixels. */
const FIT_PADDING = 28;
const FIT_MS = 250;
const MIN_KM = 1;

/**
 * How far someone goes for work, the way Hinge sets a maximum distance: a map of their area with a terracotta circle
 * of that many kilometres, their place's name on a dark label at its centre, and a slider under it. The map follows the
 * slider (the circle grows and the map zooms out to fit it); the map itself does not move, so a thumb on it never
 * changes the area by mistake. With no map (no key on the server, offline) the slider alone does the same job.
 */
export function RadiusMap({
  at,
  name,
  km,
  onKm,
}: {
  /** Where they work from. */
  at: Place;
  /** That place's name, shown on the label at the circle's centre. */
  name: string;
  km: number;
  onKm: (km: number) => void;
}) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | undefined>(undefined);
  const [shown, setShown] = useState(false);
  const latest = useRef({ at, km });
  latest.current = { at, km };

  // biome-ignore lint/correctness/useExhaustiveDependencies: opened once; later changes redraw the circle below
  useEffect(() => {
    let live = true;
    const container = box.current;
    if (!container) return;
    void openMap(container, { center: [at.lon, at.lat], zoom: 11, interactive: false }).then((m) => {
      if (!live) return m?.remove();
      map.current = m;
      if (!m) return;
      m.on("load", () => {
        const now = latest.current;
        m.addSource(SOURCE, { type: "geojson", data: circleFeature(now.at, now.km) });
        m.addLayer({
          id: FILL,
          type: "fill",
          source: SOURCE,
          paint: { "fill-color": ACCENT, "fill-opacity": FILL_OPACITY },
        });
        m.addLayer({
          id: LINE,
          type: "line",
          source: SOURCE,
          paint: { "line-color": ACCENT, "line-width": LINE_WIDTH },
        });
        m.fitBounds(circleBounds(now.at, now.km), { padding: FIT_PADDING, duration: 0 });
        setShown(true);
      });
    });
    return () => {
      live = false;
      map.current?.remove();
      map.current = undefined;
    };
  }, []);

  // The map is made while its frame is hidden, at no size, and fitted the circle to that: once shown, it takes the
  // frame's size and fits the circle again.
  useEffect(() => {
    const m = map.current;
    if (!shown || !m) return;
    m.resize();
    const now = latest.current;
    m.fitBounds(circleBounds(now.at, now.km), { padding: FIT_PADDING, duration: 0 });
  }, [shown]);

  // A new distance or place: the circle redraws and the map fits it.
  useEffect(() => {
    const m = map.current;
    const source = m?.getSource<GeoJSONSource>(SOURCE);
    if (!m || !source) return;
    source.setData(circleFeature(at, km));
    m.fitBounds(circleBounds(at, km), { padding: FIT_PADDING, duration: FIT_MS });
  }, [at, km]);

  return (
    <div className="radius-map">
      <div className="radius-map-frame" hidden={!shown} role="img" aria-label={t("map.radius_of", { km, place: name })}>
        <div ref={box} className="radius-map-canvas" />
        <span className="radius-map-label" aria-hidden="true">
          {name}
        </span>
      </div>
      <label className="radius-map-slider">
        <span className="radius-map-km">{t("card.km", { km })}</span>
        {/* No map (no key on the server, offline, or still loading): the place is named beside the distance instead. */}
        <span className={C.muted}>{shown ? t("card.radius") : t("map.radius_from", { place: name })}</span>
        <input
          type="range"
          min={MIN_KM}
          max={MAX_RADIUS_KM}
          step={1}
          value={km}
          aria-label={t("card.radius")}
          aria-valuetext={t("card.km", { km })}
          onChange={(e) => onKm(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
