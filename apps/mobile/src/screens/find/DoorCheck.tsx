import { log, type Storage, saveAddress } from "@gigsync/core";
import type { Place, SavedAddress, Session } from "@gigsync/protocol";
import { useState } from "react";
import { placesAt } from "../../adapters/geo.js";
import { addressesChanged } from "../../find/addressDesk.js";
import { useI18n } from "../../i18n.js";
import { PlaceMap } from "../../ui/PlaceMap.js";

/** Smaller than this, in degrees, the map has not moved: a jump to the same point, not the owner's hand. */
const STILL = 1e-6;
const moved = (a: Place, b: Place) => Math.abs(a.lat - b.lat) > STILL || Math.abs(a.lon - b.lon) > STILL;

/**
 * The place under the pin, by name: the locality, city and PIN the geocoder gives for the point, kept as they were
 * where it gives none or cannot be reached (the door is saved either way).
 */
async function namedAt(session: Session, address: SavedAddress, point: Place): Promise<SavedAddress> {
  try {
    const [place] = await placesAt(session, point);
    if (!place?.locality) return address;
    return { ...address, area: place.locality, city: place.city ?? address.city, pin: place.pin ?? address.pin };
  } catch (err) {
    log.warn("naming the pinned door failed", { error: err instanceof Error ? err.name : typeof err });
    return address;
  }
}

/**
 * The address in use when its point is not yet the door (typed without a map, or saved before pins): its map under the
 * "where" question, so the pin is put on the door once and reused (ADR 0050 §7). Moving the map saves that point as
 * the door, and the area takes the name of the place the pin landed in; a worker gets the door only after both sign.
 * Nothing is drawn where there is no map.
 */
export function DoorCheck({
  address,
  storage,
  session,
  onSaved,
}: {
  address: SavedAddress & { point: Place };
  storage: Storage;
  session: Session;
  /** The address saved again with its door, for the chat to send. */
  onSaved: (address: SavedAddress) => void;
}) {
  const { t } = useI18n();
  const [at, setAt] = useState<Place>(address.point);
  const [pinned, setPinned] = useState(false);
  const [shown, setShown] = useState(false);
  async function pin(point: Place) {
    if (!moved(point, at)) return;
    setAt(point);
    const next: SavedAddress = { ...(await namedAt(session, address, point)), point, pinned: true };
    try {
      await saveAddress(storage, next);
      onSaved(next);
      addressesChanged();
      setPinned(true);
    } catch (err) {
      log.warn("saving the door pin failed", { error: err instanceof Error ? err.name : typeof err });
    }
  }
  return (
    <figure className="door-check">
      <PlaceMap
        at={at}
        label={t("map.of", { place: address.area })}
        onMove={(p) => void pin(p)}
        onShown={() => setShown(true)}
      />
      {shown && (
        <figcaption className="fine" role="status">
          {t(pinned ? "find.door_saved" : "find.door_check")}
        </figcaption>
      )}
    </figure>
  );
}
