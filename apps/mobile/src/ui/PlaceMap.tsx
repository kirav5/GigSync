import type { MessageKey } from "@gigsync/core";
import type { Place } from "@gigsync/protocol";
import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { openMap } from "../adapters/map.js";
import { useI18n } from "../i18n.js";

/** Close enough to see the streets around a door. */
const STREET_ZOOM = 16;

/**
 * A map around a place (ADR 0050 §7). To pick a place (`onMove`), the pin stays in the middle and the owner moves the
 * map under it; the place under the pin is reported when the map stops. To show one, a marker holds the place while
 * the owner moves and zooms around it to see the way there. Nothing is
 * drawn when the map cannot be had (no key on the server, no connection): the screen around it works the same.
 */
/** The picking hint for an address: the pin goes on the door. */
const DOOR_HINT: MessageKey = "map.move_pin";

export function PlaceMap({
  at,
  onMove,
  onShown,
  label,
  hint = DOOR_HINT,
}: {
  at: Place;
  onMove?: (place: Place) => void;
  /** The map is drawn, so the owner sees the pin. */
  onShown?: () => void;
  /** What the map is of, for screen readers. */
  label: string;
  /** The line over a map being picked on: the door for an address, the starting point for a worker's area. */
  hint?: MessageKey;
}) {
  const { t } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | undefined>(undefined);
  const moved = useRef(onMove);
  moved.current = onMove;
  const drawn = useRef(onShown);
  drawn.current = onShown;
  const [shown, setShown] = useState(false);
  const picking = onMove !== undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: opened once; later places move the map below
  useEffect(() => {
    let live = true;
    const container = box.current;
    if (!container) return;
    void openMap(container, { center: [at.lon, at.lat], zoom: STREET_ZOOM }, picking ? undefined : at).then((m) => {
      if (!live) return m?.remove();
      map.current = m;
      setShown(m !== undefined);
      if (m) drawn.current?.();
      m?.on("moveend", () => {
        const c = m.getCenter();
        moved.current?.({ lat: c.lat, lon: c.lng });
      });
    });
    return () => {
      live = false;
      map.current?.remove();
      map.current = undefined;
    };
  }, []);

  // The map is made while its box is hidden, at no size: once shown, it fits the box.
  useEffect(() => {
    if (shown) map.current?.resize();
  }, [shown]);

  // A new place from elsewhere (the phone's location, a search): the map goes there.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    if (Math.abs(c.lat - at.lat) > 1e-6 || Math.abs(c.lng - at.lon) > 1e-6) m.jumpTo({ center: [at.lon, at.lat] });
  }, [at]);

  return (
    <div className="place-map" hidden={!shown} role="img" aria-label={label}>
      <div ref={box} className="place-map-canvas" />
      {picking && <span className="place-map-pin" aria-hidden="true" />}
      {picking && shown && <span className="place-map-hint">{t(hint)}</span>}
    </div>
  );
}
