import { type BoardSkill, type Lang, Trade, WorkCategory } from "@gigsync/protocol";
import { t } from "../i18n/t.js";

/**
 * What a household's words can be for (ADR 0059): a trade, a kind of work, or a skill a worker listed in words that fit
 * no kind. The model points at this list and writes nothing onto it, so a search never runs on a made-up label.
 */

/** Listed skills with no kind that go on the list, most-listed first: past this they are found by their name only. */
const MAX_OWN_SKILLS = 30;

export type WorkPick = { trade: Trade } | { category: WorkCategory } | { skill: BoardSkill };

export const workOptions = (listed: readonly BoardSkill[]): WorkPick[] => [
  ...Trade.options.map((trade) => ({ trade })),
  ...WorkCategory.options.map((category) => ({ category })),
  ...listed
    .filter((skill) => !skill.category)
    .slice(0, MAX_OWN_SKILLS)
    .map((skill) => ({ skill })),
];

/**
 * A kind of work as a need's skill: every listed wording of it counted, under the kind's own name in the owner's
 * language. Undefined when no worker lists it.
 */
export function categorySkill(
  category: WorkCategory,
  listed: readonly BoardSkill[],
  own: Lang,
): BoardSkill | undefined {
  const wordings = listed.filter((s) => s.category === category);
  const first = wordings[0];
  if (!first) return undefined;
  const workers = wordings.reduce((sum, s) => sum + s.workers, 0);
  return { key: first.key, text: t(own, `category.${category}`), lang: own, category, workers };
}
