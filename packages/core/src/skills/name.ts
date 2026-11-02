import type { JobTrade, Lang, Skill } from "@gigsync/protocol";
import { t } from "../i18n/t.js";

/** The work as a person reads it: a listed skill in its worker's own words (ADR 0047), else the trade's name. */
export const workName = (own: Lang, trade: JobTrade, skill?: Skill): string =>
  skill ? skill.text : t(own, `trade.${trade}`);
