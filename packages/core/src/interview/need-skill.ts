import type { BoardSkill } from "@gigsync/protocol";
import { moveOn, type NeedState } from "./need.js";
import { normalize, SPACE } from "./normalize.js";

/**
 * A need for a skill workers here list (ADR 0047): the phone matched the owner's words to the board's list, so the
 * need goes on to the generic questions and a search for that skill, with no price questions or estimate.
 */

/** Words this many or more say what the work is, so the first question ("What exactly is the work?") is answered. */
const SAYS_THE_WORK = 6;

/** The need as one for a listed skill, unless it already has a trade; the owner's words are on screen already. */
export function withSkill(s: NeedState, skill: BoardSkill, words: string): NeedState {
  if (s.draft.trade) return s;
  const said = normalize(words).split(SPACE).length >= SAYS_THE_WORK;
  const draft = { ...s.draft, skill, jobType: undefined, need: undefined, ...(said ? { detail: words.trim() } : {}) };
  return moveOn(s, draft, [{ key: "need.skill_found", params: { skill: skill.text } }]);
}
