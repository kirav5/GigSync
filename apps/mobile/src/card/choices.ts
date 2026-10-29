import { type AreaChoice, CITY_RATES, type InterviewConfig, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { AREAS } from "../ui/places.js";

/** The shortest first word of a longer area name worth listening for on its own. */
const SHORT_NAME_MIN = 3;

/**
 * Every name a worker may say or type for each pilot area: the board's name, its name in each language, and the first
 * word of a longer name ("HSR" for "HSR Layout"), which is how people say it.
 */
const AREA_CHOICES: readonly AreaChoice[] = AREAS.map((a) => {
  const names = [a.name, ...Lang.options.map((l) => t(l, `area.${a.key}`))];
  const short = names
    .filter((n) => n.includes(" "))
    .map((n) => n.split(" ")[0] ?? "")
    .filter((w) => w.length >= SHORT_NAME_MIN);
  return { key: a.key, names: [...new Set([...names, ...short])] };
});

/** The card interview's settings for an owner: their language, the pilot's areas and the city's going rates. */
export const interviewConfig = (own: Lang): InterviewConfig => ({ own, areas: AREA_CHOICES, rates: CITY_RATES });
