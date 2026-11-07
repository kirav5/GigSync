import {
  type InterviewState,
  isGreeting,
  type Ports,
  readSkill,
  Slot,
  spokenSkill,
  suggestWork,
  tradesIn,
} from "@gigsync/core";
import { answerInterview } from "./interviewStore.js";

/**
 * An answer to the card interview. At the work question, words that are a skill of the worker's own get the model's
 * suggestion of the trade or kind of work they are first, so the interview can ask "Is this TV repair?" (ADR 0059):
 * the same question the card screen asks. With no model, or nothing that fits, the words are kept as they are.
 */
export async function answerCard(ports: Ports, state: InterviewState, text: string, aloud: boolean): Promise<void> {
  if (state.slot !== Slot.trade || state.kind || isGreeting(text) || tradesIn(text).length > 0)
    return answerInterview(text, aloud);
  const read = readSkill(spokenSkill(text), state.config.own);
  const kind = "skill" in read && !read.skill.category ? await suggestWork(ports.model, read.skill.text) : undefined;
  answerInterview(text, aloud, kind);
}
