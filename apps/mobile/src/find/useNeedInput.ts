import { NeedInput, type NeedState, needInput } from "@gigsync/core";
import { useEffect } from "react";
import { useChosenModel } from "../adapters/model.js";
import { typingIn } from "./needStore.js";

/** How Find's question may be answered now, and whether typing, when off, is expected back by itself. */
export interface NeedTyping {
  input: NeedInput;
  /** Typing is off only while GigSync's model is paused; false when there is no model at all. */
  backSoon: boolean;
}

/**
 * How the question now asked in Find may be answered, kept current with the model: when nothing can read words
 * (GigSync's model paused or down and none on the phone, or lite mode chosen) typing and the mic go and the chips
 * serve alone; when a model is back, they return. The chat itself is never touched, except that a question which
 * reads differently without typing (the opening, a repair's "what is wrong?") is asked again below. `held` holds that
 * back while the owner's words are on their way to be read: a model call's failure is what pauses the model, and the
 * reading asks the list itself when it gives up.
 */
export function useNeedInput(chat: string, state: NeedState | undefined, held: boolean): NeedTyping {
  const model = useChosenModel();
  const reads = model.reads();
  const stale = state !== undefined && !held && (state.chipsOnly ?? false) === reads;
  useEffect(() => {
    if (stale) typingIn(chat, reads);
  }, [stale, chat, reads]);
  const fallback = reads ? NeedInput.words : NeedInput.chips;
  return { input: state ? needInput(state, reads) : fallback, backSoon: model.pausedForNow() };
}
