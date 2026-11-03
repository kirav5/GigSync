import {
  type AddressId,
  type AreaKey,
  coarsePoint,
  MAX_ADDRESSES,
  type Place,
  type SavedAddress,
} from "@gigsync/protocol";
import { PILOT_AREA_CHOICES } from "../estimate/area-names.js";
import { nearestPilotArea, PILOT_AREAS, type PilotArea } from "../estimate/areas.js";
import { areaIn } from "../interview/lexicon.js";
import type { AddressChoice } from "../interview/need-types.js";
import { Collection, type Storage } from "../ports.js";

/**
 * A household's saved addresses (ADR 0045), kept in the owner's storage on the phone: listed for Find's "where"
 * question, turned into the area a search and an estimate use, and into the one line the worker gets after signing.
 */

const LINE_GAP = ", ";
const PIN_GAP = " ";
const NOT_SLUG = /[^a-z0-9]+/g;
const EDGE_DASH = /^-+|-+$/g;
const SLUG_MAX = 60;

export class TooManyAddressesError extends Error {}

/** The saved addresses, oldest first. */
export async function listAddresses(storage: Storage): Promise<SavedAddress[]> {
  const all = await storage.list<SavedAddress>(Collection.addresses);
  return [...all].sort((a, b) => a.id.localeCompare(b.id));
}

/** Saves a new address or replaces one with the same id; refuses an eleventh. */
export async function saveAddress(storage: Storage, address: SavedAddress): Promise<void> {
  const all = await listAddresses(storage);
  const replacing = all.some((a) => a.id === address.id);
  if (!replacing && all.length >= MAX_ADDRESSES) throw new TooManyAddressesError("address book is full");
  await storage.put(Collection.addresses, address.id, address);
}

export const removeAddress = (storage: Storage, id: AddressId): Promise<void> =>
  storage.delete(Collection.addresses, id);

/** The address as one line, for the worker once both have signed: every part given, in the order a visitor needs. */
export function addressLine(a: SavedAddress): string {
  const parts = [a.house, a.floor, a.building, a.street, a.landmark, a.area, `${a.city}${PIN_GAP}${a.pin}`];
  return parts.filter((p): p is string => Boolean(p?.trim())).join(LINE_GAP);
}

/**
 * The saved address a need without one picked is for, so the worker never gets an address the owner replaced: the one
 * in the need's locality, else the only one, else the newest. Undefined only when nothing is saved.
 */
export function addressFor(saved: readonly SavedAddress[], locality: string | undefined): SavedAddress | undefined {
  const wanted = locality?.trim().toLowerCase();
  const inLocality = wanted ? saved.filter((a) => a.area.trim().toLowerCase() === wanted) : [];
  return inLocality.at(-1) ?? saved.at(-1);
}

/** The pilot area the address is in: named in its area field, else the one whose centre is near its point. */
export function pilotAreaOf(a: Pick<SavedAddress, "area" | "point">): PilotArea | undefined {
  const named = areaIn(a.area, PILOT_AREA_CHOICES);
  if (named) return PILOT_AREAS.find((p) => p.key === named);
  return a.point && nearestPilotArea(a.point);
}

/** A locality's name as an area slug ("Banashankari 2nd Stage" → "banashankari-2nd-stage"); undefined in other scripts. */
export function localitySlug(name: string): AreaKey | undefined {
  const slug = name.toLowerCase().replace(NOT_SLUG, "-").replace(EDGE_DASH, "").slice(0, SLUG_MAX);
  return slug.length > 0 ? slug : undefined;
}

/** The address's area key: its pilot area's key, else its locality's slug. */
export const areaKeyOfAddress = (a: SavedAddress): string => pilotAreaOf(a)?.key ?? localitySlug(a.area) ?? a.area;

/** The address as Find's "where" question offers it. */
export const addressChoice = (a: SavedAddress): AddressChoice => ({
  id: a.id,
  label: a.label,
  areaName: a.area,
  area: areaKeyOfAddress(a),
});

/** The door's exact point, for the worker once both sign: only one the owner pinned, never an area's point. */
export const doorOf = (a: SavedAddress | undefined): Place | undefined => (a?.pinned ? a.point : undefined);

/** The point a request at this address is sent with, rounded to the coarse grid; undefined when none is known. */
export function requestPoint(a: SavedAddress): Place | undefined {
  const at = a.point ?? pilotAreaOf(a);
  return at && coarsePoint({ lat: at.lat, lon: at.lon });
}
