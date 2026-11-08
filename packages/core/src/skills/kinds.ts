import {
  isTradeKind,
  type Lang,
  MAX_TRADES,
  type Skill,
  type Trade,
  WorkCategory,
  type WorkKind,
} from "@gigsync/protocol";
import { type MessageKey, t } from "../i18n/t.js";

/**
 * A kind of work as a chip and a card hold it (ADR 0061): a trade by its own value, a kind outside the trades marked
 * so the app can find its workers. Picked from the list, a kind outside the trades goes on the card as a skill under
 * its own name; its price stays its own, from what its workers list, never a trade's.
 */

/** A chip value for a kind outside the trades. */
export const KIND_PICK = "kind:";
/** A chip value for a group of kinds. */
export const GROUP_PICK = "group:";

export const kindKey = (kind: WorkKind): MessageKey =>
  isTradeKind(kind) ? `trade.${kind}` : (`category.${kind}` as MessageKey);

export const kindValue = (kind: WorkKind): string => (isTradeKind(kind) ? kind : `${KIND_PICK}${kind}`);

/** The kind outside the trades a chip names; undefined for anything else. */
export const categoryPicked = (value: string): WorkCategory | undefined =>
  value.startsWith(KIND_PICK) ? WorkCategory.safeParse(value.slice(KIND_PICK.length)).data : undefined;

/** A kind outside the trades as a card's skill: its name in the worker's language, filed under it. */
export const kindSkill = (lang: Lang, category: WorkCategory): Skill => ({
  text: t(lang, `category.${category}`),
  lang,
  category,
});

/** What a card's work is, as kinds: its trades and the kinds its skills are filed under. */
export const cardKinds = (work: { trades?: readonly Trade[]; skills?: readonly Skill[] }): WorkKind[] => [
  ...(work.trades ?? []),
  ...(work.skills ?? []).flatMap((s) => (s.category ? [s.category] : [])),
];

/** A kind picked or unpicked on a card, within the card's limit; the card as it was when it is full. */
export function toggleKind(
  lang: Lang,
  work: { trades: readonly Trade[]; skills: readonly Skill[] },
  kind: WorkKind,
): { trades: Trade[]; skills: Skill[] } {
  const trades = [...work.trades];
  const skills = [...work.skills];
  const full = trades.length + skills.length >= MAX_TRADES;
  if (isTradeKind(kind)) {
    if (trades.includes(kind)) return { trades: trades.filter((tr) => tr !== kind), skills };
    return full ? { trades, skills } : { trades: [...trades, kind], skills };
  }
  if (skills.some((s) => s.category === kind)) return { trades, skills: skills.filter((s) => s.category !== kind) };
  return full ? { trades, skills } : { trades, skills: [...skills, kindSkill(lang, kind)] };
}
