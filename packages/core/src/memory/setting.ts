import { AnswerFromMemory } from "@gigsync/protocol";
import { Collection } from "../ports.js";
import type { MemoryOwner } from "./types.js";

/**
 * Whether the agent asks its owner before using an answer it knows from past jobs, or answers and says so. One record
 * in the owner's own settings, so a second person signing in on the phone keeps their own choice.
 */
const SETTING_KEY = "answer_from_memory";

/** Until the owner chooses, the agent asks first. */
export const DEFAULT_ANSWER_FROM_MEMORY = AnswerFromMemory.enum.ask;

/** The owner's choice; a record that no longer passes the schema counts as the default. */
export async function answerFromMemory(owner: MemoryOwner): Promise<AnswerFromMemory> {
  const parsed = AnswerFromMemory.safeParse(await owner.storage.get<unknown>(Collection.ownerSettings, SETTING_KEY));
  return parsed.success ? parsed.data : DEFAULT_ANSWER_FROM_MEMORY;
}

export async function setAnswerFromMemory(owner: MemoryOwner, mode: AnswerFromMemory): Promise<void> {
  return owner.storage.put(Collection.ownerSettings, SETTING_KEY, AnswerFromMemory.parse(mode));
}
