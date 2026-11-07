import { type AreaChoice, CITY_RATES, type InterviewConfig, type NeedConfig, PILOT_AREA_CHOICES } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { knownAreas } from "../adapters/cities.js";

/**
 * The areas offered by name: the catalog's, with every area the directory serves that it does not have (ADR 0061).
 * Before the phone has the directory's list, the catalog's alone.
 */
function areas(): readonly AreaChoice[] {
  const catalog = new Set(PILOT_AREA_CHOICES.map((a) => a.key));
  return [...PILOT_AREA_CHOICES, ...knownAreas().filter((a) => !catalog.has(a.key))];
}

/** The card interview's settings for an owner: their language, the areas served and the city's going rates. */
export const interviewConfig = (own: Lang): InterviewConfig => ({ own, areas: areas(), rates: CITY_RATES });

/** Find's chat settings for an owner: their language, the areas served, the city's rates, and the phone's day. */
export const needConfig = (own: Lang, today: string): NeedConfig => ({
  own,
  areas: areas(),
  rates: CITY_RATES,
  today,
});
