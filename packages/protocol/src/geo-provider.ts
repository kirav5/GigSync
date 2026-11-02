import { z } from "zod";

/**
 * What Ola Maps answers (ADR 0045), as far as the API reads it: its reverse-geocoding and geocoding routes return
 * Google-shaped results, a formatted line, the address parts by type and a point. Parsed at the boundary, unknown
 * fields ignored; a result without a usable locality is dropped by the caller.
 */

/** The address-part types read for each field, most specific first. */
export const OlaPartType = {
  sublocality: "sublocality",
  sublocality1: "sublocality_level_1",
  neighborhood: "neighborhood",
  locality: "locality",
  postalCode: "postal_code",
  route: "route",
} as const;

const OlaPart = z.object({
  long_name: z.string(),
  types: z.array(z.string()).default([]),
});
export type OlaPart = z.infer<typeof OlaPart>;

export const OlaResult = z.object({
  formatted_address: z.string().default(""),
  address_components: z.array(OlaPart).default([]),
  geometry: z.object({ location: z.object({ lat: z.number(), lng: z.number() }) }),
});
export type OlaResult = z.infer<typeof OlaResult>;

/** Reverse geocoding answers `results`; geocoding an address answers `geocodingResults`. */
export const OlaAnswer = z.object({
  results: z.array(OlaResult).optional(),
  geocodingResults: z.array(OlaResult).optional(),
});
export type OlaAnswer = z.infer<typeof OlaAnswer>;
