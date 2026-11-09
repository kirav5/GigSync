import type { Trade } from "@gigsync/protocol";
import { readSkill, spokenSkill } from "../skills/read.js";
import type { WorkMatch } from "../skills/suggest.js";
import { advance, askable, hasWork, type InterviewState, retry } from "./card.js";
import { alsoSaid, withSkillToo, withTradesToo } from "./card-adding.js";
import { askKind, kindSkill } from "./card-kind.js";
import type { Line } from "./card-lines.js";
import { tradesIn } from "./lexicon.js";
import { isGreeting } from "./need-greeting.js";
import { tradeTitled } from "./trade-titled.js";

/** The card interview's work question (ADR 0047, ADR 0059): what the worker's answer makes of their work. */

export function onTrades(s: InterviewState, trades: Trade[]): InterviewState {
  if (trades.length === 0) return retry(s, { key: "iv.again.trade" });
  const keep = askable(trades);
  const ask_me = (s.draft.ask_me ?? []).filter((k) => keep.includes(k));
  const { skills: _replaced, ...rest } = s.draft;
  return advance(s, { ...rest, trades, ask_me });
}

/**
 * Trades the answer names without a doubt: one named outright ("change my work to plumber"), or the trade the model
 * read when the word lists find it in the words too ("मैं खाना बनाती हूँ" is a cook's), so there is nothing to confirm.
 * The word lists alone name nothing: "water tank cleaning" is not a maid's work.
 */
function namedTrades(text: string, kind: WorkMatch | null | undefined): Trade[] {
  const titled = tradeTitled(text);
  if (titled) return [titled];
  const listed = tradesIn(text);
  return kind && "trade" in kind && listed.includes(kind.trade) ? listed : [];
}

/**
 * The work, said (ADR 0047, ADR 0059): a trade or a kind of work named outright, else what the model reads the words
 * as, for the worker to confirm, else their own words in a few words, else ask again. No word in the answer decides on
 * its own: "water tank cleaning" is not a maid's work for saying "cleaning". A hello is not work. Words a card cannot
 * hold as they are (too long, a stray sign) can still be the kind the model named, kept under its name.
 */
export function onWork(s: InterviewState, text: string, kind?: WorkMatch | null): InterviewState {
  if (isGreeting(text)) return retry(s, { key: "iv.again.trade" });
  const adding = alsoSaid(text) && hasWork(s.draft);
  const read = readSkill(spokenSkill(text), s.config.own);
  const trades = "trade" in read ? [read.trade] : namedTrades(text, kind);
  if (trades.length > 0) return adding ? advance(s, withTradesToo(s.draft, trades)) : onTrades(s, trades);
  if ("problem" in read)
    return kind
      ? askKind(s, s.draft, kindSkill(kind, s.config.own), kind, [])
      : retry(s, { key: `skill.err.${read.problem}` });
  if (!("skill" in read)) return s;
  const kept: Line[] = [{ key: "iv.skill_kept", params: { skill: read.skill.text } }];
  const draft = adding
    ? withSkillToo(s.draft, read.skill)
    : { ...s.draft, trades: [], skills: [read.skill], ask_me: [] };
  if (kind && !read.skill.category) return askKind(s, draft, read.skill, kind, kept);
  return advance(s, draft, kept);
}
