import type { Arrangement, BoardSkill } from "@gigsync/protocol";
import { afterOutside, moveOn, NeedSlot, type NeedState } from "./need.js";
import { withSaidArrangement } from "./need-arrangement.js";
import { parseNeed, withoutMoney } from "./need-parse.js";
import type { NeedConfig, NeedDraft } from "./need-types.js";
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
 * Where, when and the budget the owner's words gave ("tomorrow in Jayanagar, my budget is 1000 rupees"), kept where
 * the draft has none: a reading decided the work, and the word lists still read what they are sure of. The words
 * the workers read go without their budget, which never leaves the phone.
 */
function withSaid(d: NeedDraft, words: string, config: Pick<NeedConfig, "areas" | "today">): NeedDraft {
  const said = parseNeed(words, config);
  return {
    ...(said.area ? { area: said.area } : {}),
    ...(said.day ? { day: said.day } : {}),
    ...(said.time ? { time: said.time } : {}),
    ...(said.budget_paise ? { budget_paise: said.budget_paise } : {}),
    ...d,
  };
}

/**
 * The need as one for a listed skill, unless it already has a trade the owner did not replace by picking from the
 * list; the owner's words are on screen already.
 */
export function withSkill(s: NeedState, skill: BoardSkill, words: string, how: SkillHow = {}): NeedState {
  const at = s.slot === NeedSlot.outside ? afterOutside(s) : s;
  if (at.draft.trade && !how.picked) return s;
  const base = withSaid(how.picked ? withoutWork(at.draft) : at.draft, words, at.config);
  const told = withoutMoney(words);
  const said = how.saysWhat || normalize(told).split(SPACE).length >= SAYS_THE_WORK;
  const found = { ...base, skill, jobType: undefined, need: undefined, ...(said && told ? { detail: told } : {}) };
  const draft = withSaidArrangement(found, how.arrangement);
  return moveOn(at, draft, [{ key: "need.skill_found", params: { skill: skill.text } }]);
}
