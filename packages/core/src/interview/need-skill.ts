import type { BoardSkill } from "@gigsync/protocol";
import { arrangementSaid } from "./arrangement-words.js";
import { afterOutside, moveOn, NeedSlot, type NeedState } from "./need.js";
import { withSaidArrangement } from "./need-arrangement.js";
import { normalize, SPACE } from "./normalize.js";

/**
 * A need for a skill workers here list (ADR 0047): the phone matched the owner's words to the board's list, so the
 * need goes on to the generic questions and a search for that skill, with no price questions or estimate. How long
 * the work is for is asked as for any work that can be done several ways (ADR 0051), unless the words said it.
 */

/** Words this many or more say what the work is, so the first question ("What exactly is the work?") is answered. */
const SAYS_THE_WORK = 6;

/** The need as one for a listed skill, unless it already has a trade; the owner's words are on screen already. */
export function withSkill(s: NeedState, skill: BoardSkill, words: string): NeedState {
  const at = s.slot === NeedSlot.outside ? afterOutside(s) : s;
  if (at.draft.trade) return s;
  const said = normalize(words).split(SPACE).length >= SAYS_THE_WORK;
  const found = { ...at.draft, skill, jobType: undefined, need: undefined, ...(said ? { detail: words.trim() } : {}) };
  const draft = withSaidArrangement(found, arrangementSaid(words));
  return moveOn(at, draft, [{ key: "need.skill_found", params: { skill: skill.text } }]);
}
