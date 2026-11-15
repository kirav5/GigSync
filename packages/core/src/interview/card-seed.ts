import { type Lang, MAX_SKILLS, MAX_TRADES, type Skill, skillKey, type Trade, type WorkKind } from "@gigsync/protocol";
import { cardKinds, kindKey, toggleKind } from "../skills/kinds.js";
import { readSkill, spokenSkill } from "../skills/read.js";
import { type CardDraft, type InterviewState, start } from "./card.js";
import type { InterviewConfig } from "./card-config.js";
import { fileNext, type OwnWords } from "./card-guess.js";

/**
 * A first card's interview after the worker picked their work on the tiles (start/WorkStep.tsx): the work is in the
 * draft already, so the chat goes on to the details and opens by saying what was picked, never asking it again. A kind
 * outside the trades goes on as a skill under its own name, as it does from the list on My card (ADR 0061); past the
 * card's limit a kind is left off, as there. Work added in the worker's own words (`custom`) goes on as said: a trade
 * or a kind named outright as that, anything else as their words, which the chat then asks about against the kinds
 * closest to them (`card-guess.ts`). With nothing picked it is the interview as it always began.
 */

interface Work {
  trades: Trade[];
  skills: Skill[];
}

const isFull = (w: Work): boolean => w.trades.length + w.skills.length >= MAX_TRADES;

/** The worker's own words added to the work picked, and those of them to ask about. */
function withOwnWords(lang: Lang, picked: Work, custom: readonly string[]): { work: Work; unsure: OwnWords[] } {
  let work = picked;
  const unsure: OwnWords[] = [];
  for (const said of custom) {
    const read = readSkill(spokenSkill(said), lang);
    if (isFull(work) || "problem" in read) continue;
    if ("trade" in read) {
      if (!work.trades.includes(read.trade)) work = toggleKind(lang, work, read.trade);
      continue;
    }
    const { skill } = read;
    const known = work.skills.some((sk) => skillKey(sk.text) === skillKey(skill.text));
    if (known || (skill.category && work.skills.some((sk) => sk.category === skill.category))) continue;
    // A card holds only so many skills (ADR 0047): past that, words are left off rather than make a card the board
    // would refuse, even though some may yet be filed as a trade.
    if (work.skills.length >= MAX_SKILLS) continue;
    work = { ...work, skills: [...work.skills, skill] };
    if (!skill.category) unsure.push({ skill, said: said.trim() });
  }
  return { work, unsure };
}

export function startWithWork(
  config: InterviewConfig,
  kinds: readonly WorkKind[],
  custom: readonly string[] = [],
): InterviewState {
  const none: Work = { trades: [], skills: [] };
  const picked = kinds.reduce((w, kind) => toggleKind(config.own, w, kind), none);
  const { work, unsure } = withOwnWords(config.own, picked, custom);
  const draft: CardDraft = { trades: work.trades, ...(work.skills.length > 0 ? { skills: work.skills } : {}) };
  const state = start(config, draft);
  const named = cardKinds(draft);
  const notes = named.length > 0 ? [{ key: "iv.picked_work" as const, names: { work: named.map(kindKey) } }] : [];
  if (unsure.length > 0) return fileNext(state, draft, unsure, notes);
  return named.length > 0 ? { ...state, notes } : state;
}
