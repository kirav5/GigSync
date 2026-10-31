import { Lang } from "@gigsync/protocol";
import { t } from "../i18n/t.js";
import type { AreaChoice } from "../interview/card.js";
import { PILOT_AREAS } from "./areas.js";

/** The shortest first word of a longer area name worth listening for on its own. */
const SHORT_NAME_MIN = 3;
const WORD_GAP = " ";

/**
 * Every name an owner may say or type for each pilot area: the board's name, its name in each language, and the first
 * word of a longer name ("HSR" for "HSR Layout"), which is how people say it.
 */
export const PILOT_AREA_CHOICES: readonly AreaChoice[] = PILOT_AREAS.map((a) => {
  const names = [a.name, ...Lang.options.map((l) => t(l, `area.${a.key}`))];
  const short = names
    .filter((n) => n.includes(WORD_GAP))
    .map((n) => n.split(WORD_GAP)[0] ?? "")
    .filter((w) => w.length >= SHORT_NAME_MIN);
  return { key: a.key, names: [...new Set([...names, ...short])] };
});
