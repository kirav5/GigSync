import {
  hear,
  type InterviewState,
  isGreeting,
  log,
  type Ports,
  readSkill,
  readWork,
  Slot,
  spokenSkill,
} from "@gigsync/core";
import { GEO_QUERY_MIN, type Session } from "@gigsync/protocol";
import { placesNamed } from "../adapters/geo.js";
import { answerInterview, placeInterview } from "./interviewStore.js";
import { type FoundPlace, workPlace } from "./workPlace.js";

/**
 * An area answer that is no pilot area ("Malleshwaram"): looked up as the My card form's search does (ADR 0045), and
 * the first place it names becomes the work area. Nothing found, or the lookup off: the interview asks again.
 */
async function placeSaid(session: Session, words: string): Promise<FoundPlace | undefined> {
  const q = words.trim();
  if (q.length < GEO_QUERY_MIN) return undefined;
  try {
    const [first] = await placesNamed(session, q);
    return first ? workPlace(first, first.point) : undefined;
  } catch (err) {
    log.warn("area lookup failed", { error: err instanceof Error ? err.name : typeof err });
    return undefined;
  }
}

/**
 * An answer to the card interview. At the work question, words that are not a trade or a kind of work named outright
 * go to the model first, which reads which kind of work they are, so the interview can ask "Is this TV repair?"
 * (ADR 0059): the same question the card screen asks. No word in the answer decides on its own ("water tank cleaning"
 * is no maid's work). With no model, or nothing that fits, the words are kept as they are.
 */
export async function answerCard(
  ports: Ports,
  state: InterviewState,
  text: string,
  aloud: boolean,
  session?: Session,
): Promise<void> {
  // Words the area question did not take (no pilot area in them) are looked up as a place before it asks again.
  if (state.slot === Slot.area && session && hear(state, text).slot === Slot.area) {
    const found = await placeSaid(session, text);
    if (found) return placeInterview(found.area, found.place);
  }
  if (state.slot !== Slot.trade || state.kind || state.filing || isGreeting(text)) return answerInterview(text, aloud);
  const words = spokenSkill(text);
  const read = readSkill(words, state.config.own);
  const named = "trade" in read || ("skill" in read && read.skill.category !== undefined);
  const kind = named ? undefined : await readWork(ports.model, words);
  answerInterview(text, aloud, kind ?? undefined);
}
