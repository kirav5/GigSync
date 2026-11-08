import { MAX_TRADES, type Skill, skillKey, type Trade } from "@gigsync/protocol";
import type { CardDraft } from "./card.js";
import { finder, firstIn, normalize } from "./normalize.js";

/**
 * "I also do cat care" adds to a card; "I do cat care" says what the work is. A worker with a card who says they also
 * do something keeps what is on it (as a real worker's TV mechanic was replaced by cat care before this), within the
 * card's limit.
 */

const ALSO_WORDS = ["also", "too", "as well", "bhi", "भी", "ಕೂಡ", "ಸಹ", "koodaa"].map((w) => finder(normalize(w)));

/** The words say this is work besides what is on the card. */
export const alsoSaid = (text: string): boolean => firstIn(normalize(text), ALSO_WORDS) >= 0;

const room = (d: CardDraft) => (d.trades?.length ?? 0) + (d.skills?.length ?? 0) < MAX_TRADES;

/** The card with this skill too, unless it is on it already or the card is full. */
export function withSkillToo(d: CardDraft, skill: Skill): CardDraft {
  const skills = d.skills ?? [];
  if (skills.some((s) => skillKey(s.text) === skillKey(skill.text)) || !room(d)) return d;
  return { ...d, skills: [...skills, skill] };
}

/** The card with these trades too, as many as fit. */
export function withTradesToo(d: CardDraft, trades: readonly Trade[]): CardDraft {
  let next = d;
  for (const tr of trades)
    if (!(next.trades ?? []).includes(tr) && room(next)) next = { ...next, trades: [...(next.trades ?? []), tr] };
  return next;
}
