import { CITY_RATES, type InterviewConfig, type NeedConfig, PILOT_AREA_CHOICES } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";

/** The card interview's settings for an owner: their language, the pilot's areas and the city's going rates. */
export const interviewConfig = (own: Lang): InterviewConfig => ({ own, areas: PILOT_AREA_CHOICES, rates: CITY_RATES });

/** Find's chat settings for an owner: their language, the pilot's areas, the city's rates, and the phone's day. */
export const needConfig = (own: Lang, today: string): NeedConfig => ({
  own,
  areas: PILOT_AREA_CHOICES,
  rates: CITY_RATES,
  today,
});
