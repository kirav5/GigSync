import { askingModel, modelPriceStep, type NeedState, type Ports, priceContext } from "@gigsync/core";
import { useEffect, useRef } from "react";
import { stepNeed } from "./needStore.js";

/**
 * The price questions' side effect in Find (ADR 0058): for work outside the trades, one model call writes them when
 * the need waits on it. A model that fails or is slow leaves the need without them (core's `withPriceStep`).
 */
export function usePriceQuestions(ports: Ports, chat: string, state: NeedState | undefined): void {
  const asking = useRef<string | undefined>(undefined);
  const waiting = state !== undefined && askingModel(state);
  const turn = `${chat}:${state?.draft.askedDrivers ?? 0}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: one model call per need, keyed on the chat and count
  useEffect(() => {
    if (!state || !waiting || asking.current === turn) return;
    asking.current = turn;
    void modelPriceStep(ports.model, priceContext(state)).then((step) => stepNeed(chat, step));
  }, [waiting, turn]);
}
