import { awaitingModel, modelPriceStep, type NeedState, type Ports, priceContext } from "@gigsync/core";
import { useEffect, useRef } from "react";
import { stepNeed } from "./needStore.js";

/**
 * The price questions' side effect in Find (ADR 0041 §2): with a usable phone model, ask it for the next question
 * whenever the need waits on it, once per question. A model that fails or is slow hands over to the fixed questions
 * (core's `withPriceStep`). The model is the phone's own; nothing it reads or writes leaves the phone.
 */
export function usePriceQuestions(ports: Ports, chat: string, state: NeedState | undefined): void {
  const asking = useRef<string | undefined>(undefined);
  const waiting = state !== undefined && awaitingModel(state.draft);
  const turn = `${chat}:${state?.draft.askedDrivers ?? 0}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: one model call per question, keyed on the chat and count
  useEffect(() => {
    if (!state || !waiting || asking.current === turn) return;
    asking.current = turn;
    void modelPriceStep(ports.model, priceContext(state)).then((step) => stepNeed(chat, step));
  }, [waiting, turn]);
}
