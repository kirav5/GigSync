import {
  askingFirst,
  askingModel,
  firstQuestion,
  modelFirstQuestion,
  modelPriceStep,
  type NeedState,
  type Ports,
  priceContext,
  t,
  workOf,
} from "@gigsync/core";
import { useEffect, useRef } from "react";
import { firstNeed, stepNeed } from "./needStore.js";

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

/**
 * After a kind of work is tapped on the list (ADR 0061), the model words its first question for that work, once per
 * need; with no answer in time the fixed question is asked.
 */
export function useFirstQuestion(ports: Ports, chat: string, state: NeedState | undefined): void {
  const asking = useRef<string | undefined>(undefined);
  const waiting = state !== undefined && askingFirst(state);
  // biome-ignore lint/correctness/useExhaustiveDependencies: one model call per tapped need, keyed on the chat
  useEffect(() => {
    if (!state || !waiting || asking.current === chat) return;
    asking.current = chat;
    const d = state.draft;
    const key = firstQuestion(workOf(d));
    const own = state.config.own;
    const work = d.trade ? t(own, `trade.${d.trade}`) : (d.skill?.text ?? "");
    if (!key) return firstNeed(chat, undefined);
    void modelFirstQuestion(ports.model, work, key, own).then((text) => firstNeed(chat, text));
  }, [waiting, chat]);
}
