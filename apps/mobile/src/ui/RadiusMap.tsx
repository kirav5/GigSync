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
/** The map's centre and `at` closer than this, in degrees, are the same point: the map moved there itself. */
const SAME_POINT = 1e-6;

const centreOf = (m: MapLibreMap): Place => {
  const c = m.getCenter();
  return { lat: c.lat, lon: c.lng };
};
const samePoint = (a: Place, b: Place) => Math.abs(a.lat - b.lat) < SAME_POINT && Math.abs(a.lon - b.lon) < SAME_POINT;

/**
 * How far someone goes for work, the way Hinge sets a maximum distance: a map of their area with a terracotta circle
 * of that many kilometres, their place's name on a dark label at its centre, and a slider under it. The map follows the
 * slider (the circle grows and the map zooms out to fit it). With `onMove` it is also where they start from, the one
 * map on the page: a thumb drags the map under the circle, which stays in the middle, and letting go sets the place.
 * Without it the map does not move, so a thumb on it never changes the area by mistake. With no map (no key on the
 * server, offline) the slider alone does the same job.
 */
export function RadiusMap({
  at,
  name,
  km,
  onKm,
  onMove,
}: {
  /** Where they work from. */
  at: Place;
  /** That place's name, shown on the label at the circle's centre. */
  name: string;
  km: number;
  onKm: (km: number) => void;
  /** Where they start from moved on the map: drag to pick it. */
  onMove?: ((at: Place) => void) | undefined;
}) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | undefined>(undefined);
  const [shown, setShown] = useState(false);
  const latest = useRef({ at, km, onMove });
  latest.current = { at, km, onMove };
  const picking = onMove !== undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: opened once; later changes redraw the circle below
  useEffect(() => {
    let live = true;
    const container = box.current;
    if (!container) return;
    void openMap(container, { center: [at.lon, at.lat], zoom: 11 }).then((m) => {
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
      // Drag only, and only while there is a place to move (below): the slider sets the size, so pinching or turning
      // the map would only fight it.
      if (!latest.current.onMove) m.dragPan.disable();
      m.scrollZoom.disable();
      m.touchZoomRotate.disable();
      m.doubleClickZoom.disable();
      m.dragRotate.disable();
      m.keyboard.disable();
      // The circle stays in the middle while the map moves under it; letting go sets the place there.
      let dragged = false;
      m.on("dragstart", () => {
        dragged = true;
      });
      m.on("move", () => {
        if (dragged) m.getSource<GeoJSONSource>(SOURCE)?.setData(circleFeature(centreOf(m), latest.current.km));
      });
      m.on("moveend", () => {
        if (!dragged) return;
        dragged = false;
        latest.current.onMove?.(centreOf(m));
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

  // A place to move comes and goes (found by search or location, or a pilot area picked from the list): the thumb can
  // drag the map only while there is one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `shown` re-runs it once the map exists, which a ref cannot
  useEffect(() => {
    const pan = map.current?.dragPan;
    if (picking) pan?.enable();
    else pan?.disable();
  }, [picking, shown]);

  // A new distance, or a place from elsewhere (the phone's location, a search): the circle redraws and the map fits
  // it. A place the map was dragged to is already in the middle, so the map stays where the thumb left it.
  useEffect(() => {
    const m = map.current;
    const source = m?.getSource<GeoJSONSource>(SOURCE);
    if (!m || !source) return;
    const here = latest.current.at;
    source.setData(circleFeature(here, km));
    m.fitBounds(circleBounds(here, km), { padding: FIT_PADDING, duration: FIT_MS });
  }, [km]);
  // The place alone; the distance has its own effect above.
  useEffect(() => {
    const m = map.current;
    const source = m?.getSource<GeoJSONSource>(SOURCE);
    if (!m || !source) return;
    source.setData(circleFeature(at, latest.current.km));
    if (!samePoint(centreOf(m), at))
      m.fitBounds(circleBounds(at, latest.current.km), { padding: FIT_PADDING, duration: FIT_MS });
  }, [at]);

  return (
    <div className="radius-map">
      <div className="radius-map-frame" hidden={!shown} role="img" aria-label={t("map.radius_of", { km, place: name })}>
        <div ref={box} className="radius-map-canvas" />
        <span className="radius-map-label" aria-hidden="true">
          {name}
        </span>
        {picking && <span className="place-map-hint">{t("map.move_area")}</span>}
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
