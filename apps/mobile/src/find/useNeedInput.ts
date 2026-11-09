import { chipsOnlyNeed, NeedInput, type NeedState, needInput } from "@gigsync/core";
import { useEffect } from "react";
import { useChosenModel } from "../adapters/model.js";
import { chipsOnlyIn } from "./needStore.js";

/**
 * How the question now asked in Find may be answered, kept current with the model: when nothing can read words
 * (GigSync's model paused or down and none on the phone, or lite mode chosen) typing and the mic go and the chips
 * serve alone; when a model is back, they return. The chat itself is never touched, except that an opening still
 * inviting a sentence asks the list instead. `reading` holds that back while a model call is reading the owner's
 * words: its failure is what pauses the model, and the reading asks the list itself when it gives up.
 */
export function useNeedInput(chat: string, state: NeedState | undefined, reading: boolean): NeedInput {
  const reads = useChosenModel().reads();
  const inviting = state !== undefined && !reads && !reading && chipsOnlyNeed(state) !== state;
  useEffect(() => {
    if (inviting) chipsOnlyIn(chat);
  }, [inviting, chat]);
  if (state) return needInput(state, reads);
  return reads ? NeedInput.words : NeedInput.chips;
}
