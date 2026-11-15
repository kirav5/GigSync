import {
  log,
  type MessageKey,
  pilotAreaOf,
  type Storage,
  saveAddress,
  served,
  TooManyAddressesError,
} from "@gigsync/core";
import { AddressLabel, type GeoPlace, PinCode, type Place, SavedAddress, type Session } from "@gigsync/protocol";
import { useState } from "react";
import { ulid } from "ulid";
import { homeCity, servesAnywhere, useServedCities } from "../../adapters/cities.js";
import { placesNamed } from "../../adapters/geo.js";
import { EMPTY, FIELDS, type FieldName, type Values } from "./AddressFields.js";

/** "Sorry, we're not in your area yet": a place outside every city GigSync serves. */
export const NOT_SERVED: MessageKey = "addr.not_served";
/** "Which of these areas is it nearest to?": GigSync could not place a typed address. */
export const NEAR: MessageKey = "addr.near";
const MISSING: MessageKey = "addr.err_missing";
const ID_PREFIX = "adr_";
/** The pilot's city, filled in for the owner to change: GigSync runs in Bengaluru first. */
const PILOT_CITY_NAME = "Bengaluru";

/** Where the point came from: the map as it opened, the phone's fix, a search, the owner's hand, or the typed area. */
export const PointFrom = { seed: "seed", phone: "phone", search: "search", moved: "moved", typed: "typed" } as const;
export type PointFrom = (typeof PointFrom)[keyof typeof PointFrom];

/** The point, and where it came from. */
export interface Spot {
  at: Place;
  from: PointFrom;
}

/** The point of a typed address, from search, when the owner neither used their location nor picked a place. */
async function pointFor(session: Session, v: Values, near: Place | undefined): Promise<Place | undefined> {
  try {
    const [place] = await placesNamed(session, `${v.area} ${v.city} ${v.pin}`, near);
    return place?.point;
  } catch (err) {
    log.warn("finding the typed area failed", { error: err instanceof Error ? err.name : typeof err });
    return undefined;
  }
}

/**
 * A new saved address as the owner fills it in (ADR 0045), shared by the door pin and the typed form: the fields, the
 * label, the point and where it came from, what went wrong, and saving. Kept on this phone only; the worker gets it
 * once both have signed.
 */
export function useAddressDraft(session: Session, storage: Storage, onSaved: (address: SavedAddress) => void) {
  const cities = useServedCities(session);
  const isServed = (at: Place) => served(at, cities, servesAnywhere());
  /** The centre of the city in use: where the map opens and the places search looks first. */
  const centre = cities?.find((c) => c.key === homeCity())?.centre ?? cities?.[0]?.centre;
  const [values, setValues] = useState<Values>({ ...EMPTY, city: PILOT_CITY_NAME });
  const [label, setLabel] = useState<AddressLabel>(AddressLabel.enum.home);
  const [spot, setSpot] = useState<Spot>();
  const [found, setFound] = useState<string>();
  const [problem, setProblem] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);

  const set = (name: FieldName, value: string) => setValues((v) => ({ ...v, [name]: value }));

  /** A place GigSync named (the phone's location, a search, the map stopping): its area, city and PIN filled in. */
  function fillFrom(place: GeoPlace, at: Place, from?: PointFrom): boolean {
    // Outside the cities GigSync serves (ADR 0050 §6): said at once, and nothing filled in.
    if (!isServed(at)) {
      setProblem(NOT_SERVED);
      return false;
    }
    setProblem(undefined);
    setValues((v) => ({
      ...v,
      area: place.locality,
      city: place.city ?? v.city,
      pin: place.pin ?? v.pin,
      street: v.street || (place.street ?? ""),
    }));
    if (from) setSpot({ at, from });
    setFound(place.locality);
    return true;
  }

  /** Where the typed address is: found by search, else its pilot area by name; undefined when GigSync cannot tell. */
  async function placeTyped(): Promise<Place | undefined> {
    const at = (await pointFor(session, values, centre)) ?? pilotAreaOf(values);
    return at && { lat: at.lat, lon: at.lon };
  }

  /** Whether the fields hold a PIN code; says what is wrong when they do not. */
  function pinOk(): boolean {
    const pin = values.pin.trim();
    if (PinCode.safeParse(pin).success) return true;
    setProblem(pin ? "addr.err_pin" : MISSING);
    return false;
  }

  /** Saves the address at `at`; false when a required field is empty, which is said. */
  async function store(at: Place, pinned: boolean): Promise<boolean> {
    const filled = Object.fromEntries(FIELDS.map((f) => [f, values[f].trim()]).filter(([, v]) => v));
    const parsed = SavedAddress.safeParse({ id: `${ID_PREFIX}${ulid()}`, label, ...filled, point: at, pinned });
    if (!parsed.success) {
      setProblem(MISSING);
      return false;
    }
    await saveAddress(storage, parsed.data);
    onSaved(parsed.data);
    return true;
  }

  /** Runs a save, busy meanwhile; a full address book or any other failure is said. */
  async function saving(work: () => Promise<unknown>): Promise<void> {
    setBusy(true);
    try {
      await work();
    } catch (err) {
      setProblem(err instanceof TooManyAddressesError ? "addr.max" : "error.generic");
    } finally {
      setBusy(false);
    }
  }

  return {
    cities,
    centre,
    isServed,
    values,
    set,
    label,
    setLabel,
    spot,
    setSpot,
    found,
    problem,
    setProblem,
    busy,
    fillFrom,
    placeTyped,
    pinOk,
    store,
    saving,
  };
}
