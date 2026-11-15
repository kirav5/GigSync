import { readSkill, spokenSkill } from "@gigsync/core";
import { GROUP_KINDS, type Lang, WorkGroup, type WorkKind } from "@gigsync/protocol";

/** Every kind of work in the protocol's taxonomy (ADR 0061), group by group as Find shows them: the work step's chips. */
export const ALL_KINDS: readonly WorkKind[] = WorkGroup.options.flatMap((g) => GROUP_KINDS[g]);

/**
 * The kinds whose name, in the reader's language or in English, holds every word typed; all of `kinds` for no words.
 * `names` gives each kind's names to search.
 */
export function kindsMatching(
  kinds: readonly WorkKind[],
  query: string,
  names: (kind: WorkKind) => readonly string[],
): WorkKind[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...kinds];
  return kinds.filter((kind) => {
    const said = names(kind).join(" ").toLocaleLowerCase();
    return words.every((w) => said.includes(w));
  });
}

/**
 * The words typed or said, when they can go on a card as the worker's own work: not a trade or a kind named outright
 * (its chip is on the page), and short and clean enough for the board (ADR 0047 §3). Undefined for anything else.
 */
export function ownWorkOf(query: string, lang: Lang): string | undefined {
  const words = query.trim();
  const read = readSkill(spokenSkill(words), lang);
  return "skill" in read && !read.skill.category ? words : undefined;
}
