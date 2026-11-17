import { type InterviewState, isGreeting, type Ports, readSkill, readWork, Slot, spokenSkill } from "@gigsync/core";
import { answerInterview } from "./interviewStore.js";

/**
 * An answer to the card interview. At the work question, words that are not a trade or a kind of work named outright
 * go to the model first, which reads which kind of work they are, so the interview can ask "Is this TV repair?"
 * (ADR 0059): the same question the card screen asks. No word in the answer decides on its own ("water tank cleaning"
 * is no maid's work). With no model, or nothing that fits, the words are kept as they are.
 */
export async function answerCard(ports: Ports, state: InterviewState, text: string, aloud: boolean): Promise<void> {
  if (state.slot !== Slot.trade || state.kind || state.filing || isGreeting(text)) return answerInterview(text, aloud);
  const words = spokenSkill(text);
  const read = readSkill(words, state.config.own);
  const named = "trade" in read || ("skill" in read && read.skill.category !== undefined);
  const kind = named ? undefined : await readWork(ports.model, words);
  answerInterview(text, aloud, kind ?? undefined);
}
