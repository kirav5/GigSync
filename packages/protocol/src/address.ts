import { z } from "zod";
import { prefixedId } from "./ids.js";
import { LOCALITY_MAX, Place } from "./place.js";

/**
 * Addresses and geocoding (ADR 0045). A household's saved addresses live on its phone only; the worker gets the one a
 * job is for, as a line of text, once both have signed. The phone sends only coarse points (`coarsePoint`) to the
 * geocoding routes, which ask Ola Maps from the API, so the provider never sees who asked or from where.
 */

export const AddressId = prefixedId("adr");
export type AddressId = z.infer<typeof AddressId>;

/** What an address is called on its chip. */
export const AddressLabel = z.enum(["home", "work", "other"]);
export type AddressLabel = z.infer<typeof AddressLabel>;

/** An Indian PIN code: six digits, never starting with 0. */
export const PinCode = z.string().regex(/^[1-9]\d{5}$/, "PIN code");
export type PinCode = z.infer<typeof PinCode>;

const SHORT_MAX = 60;
const LONG_MAX = 120;
/** A household keeps at most this many saved addresses. */
export const MAX_ADDRESSES = 10;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();

/** One saved address, as the form collects it. `point` is exact and never leaves the phone. */
export const SavedAddress = z.object({
  id: AddressId,
  label: AddressLabel,
  /** House or flat number. */
  house: text(SHORT_MAX),
  floor: optionalText(SHORT_MAX),
  /** Building, apartment or society name. */
  building: optionalText(LONG_MAX),
  street: optionalText(LONG_MAX),
  landmark: optionalText(LONG_MAX),
  /** The locality, as shown to workers before signing. */
  area: text(LOCALITY_MAX),
  city: text(SHORT_MAX),
  pin: PinCode,
  /** Where the owner said they are, when they used their location; else the locality's point from search. */
  point: Place.optional(),
});
export type SavedAddress = z.infer<typeof SavedAddress>;

/** `GET /v1/geo/reverse?lat&lon`: a point, which the API rounds to the coarse grid again before using it. */
export const GeoReverseQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});
export type GeoReverseQuery = z.infer<typeof GeoReverseQuery>;

export const GEO_QUERY_MIN = 3;
export const GEO_QUERY_MAX = 80;

/** `GET /v1/geo/search?q`: what the owner typed, at least a few letters (the app waits for them to stop typing). */
export const GeoSearchQuery = z.object({ q: z.string().trim().min(GEO_QUERY_MIN).max(GEO_QUERY_MAX) });
export type GeoSearchQuery = z.infer<typeof GeoSearchQuery>;

/** A place a geocoder found: the parts the address form fills in, and its point on the coarse grid. */
export const GeoPlace = z.object({
  /** The provider's whole line, shown in a search result. */
  label: text(LONG_MAX * 2),
  locality: text(LOCALITY_MAX),
  city: optionalText(SHORT_MAX),
  pin: PinCode.optional(),
  street: optionalText(LONG_MAX),
  point: Place,
});
export type GeoPlace = z.infer<typeof GeoPlace>;

export const MAX_GEO_PLACES = 5;

/** Both geocoding routes answer with this; an empty list when nothing matched. */
export const GeoResult = z.object({ places: z.array(GeoPlace).max(MAX_GEO_PLACES) });
export type GeoResult = z.infer<typeof GeoResult>;
