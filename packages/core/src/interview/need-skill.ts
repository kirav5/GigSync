import type { Arrangement, BoardSkill } from "@gigsync/protocol";
import { afterOutside, moveOn, NeedSlot, type NeedState } from "./need.js";
import { withSaidArrangement } from "./need-arrangement.js";
import type { NeedDraft } from "./need-types.js";
import { normalize, SPACE } from "./normalize.js";

/**
 * A need for a skill workers here list (ADR 0047): the phone matched the owner's words to the board's list, so the
 * need goes on to the generic questions and a search for that skill, with no price questions or estimate. How long
 * the work is for is asked as for any work that can be done several ways (ADR 0051), unless a model read it from the
 * words.
 */

/** Words this many or more say what the work is, so the first question ("What exactly is the work?") is answered. */
const SAYS_THE_WORK = 6;

/** How the skill was arrived at. */
export interface SkillHow {
  /** A model read the words as saying what is wanted, however few ("my tv not working"). */
  saysWhat?: boolean;
  /** How a model read the words as hiring the work (`readTurn`); the word lists never guess it. */
  arrangement?: Arrangement | undefined;
  /** The owner picked the kind from the list: it replaces whatever work an earlier reading of their words set. */
  picked?: boolean;
}

/** The draft with no work in it: what an earlier reading of the work set is gone; where, when and the budget stay. */
function withoutWork(d: NeedDraft): NeedDraft {
  const {
    trade: _trade,
    detail: _detail,
    scope: _scope,
    drivers: _drivers,
    notKnown: _notKnown,
    askedDrivers: _asked,
    priceDone: _priceDone,
    modelAsk: _modelAsk,
    facts: _facts,
    jobType: _jobType,
    arrangement: _arrangement,
    fits: _fits,
    ...kept
  } = d;
  return kept;
}

/**
 * The need as one for a listed skill, unless it already has a trade the owner did not replace by picking from the
 * list; the owner's words are on screen already.
 */
export function withSkill(s: NeedState, skill: BoardSkill, words: string, how: SkillHow = {}): NeedState {
  const at = s.slot === NeedSlot.outside ? afterOutside(s) : s;
  if (at.draft.trade && !how.picked) return s;
  const base = how.picked ? withoutWork(at.draft) : at.draft;
  const said = how.saysWhat || normalize(words).split(SPACE).length >= SAYS_THE_WORK;
  const found = { ...base, skill, jobType: undefined, need: undefined, ...(said ? { detail: words.trim() } : {}) };
  const draft = withSaidArrangement(found, how.arrangement);
  return moveOn(at, draft, [{ key: "need.skill_found", params: { skill: skill.text } }]);
}
