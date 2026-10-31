import {
  type ChatSlots,
  type Explanation,
  type MarketQuestion,
  type Model,
  marketAnswer,
  marketOfRoute,
  marketRequest,
  PILOT_AREA_CHOICES,
} from "@gigsync/core";
import type { Lang, Session, Trade } from "@gigsync/protocol";
import { PILOT_CITY } from "../ui/places.js";
import { fetchEstimate } from "./useEstimate.js";

/**
 * Market questions in Talk and Find (ADR 0039 §2, ADR 0040): "what do cooks charge in Jayanagar?" answered from the same
 * estimate route as the rate and budget questions, in the area named (else the city), worded by the phone's model when
 * its numbers check, else by the template; where an amount asked about falls is always the template's.
 */

/** The market question a routed message asks, read against the pilot's areas; `own` is a worker's own trade. */
export const routedMarket = (text: string, slots: ChatSlots, own?: Trade): MarketQuestion | undefined =>
  marketOfRoute(text, slots, { areas: PILOT_AREA_CHOICES, ...(own ? { own } : {}) });

/** The answer to a market question, in the owner's language. Never fails: no estimate is an answer too. */
export async function answerMarket(
  session: Session,
  model: Model,
  lang: Lang,
  question: MarketQuestion,
): Promise<Explanation> {
  const request = marketRequest(PILOT_CITY, question);
  const found = request ? await fetchEstimate(session, request) : undefined;
  return marketAnswer(model, lang, PILOT_CITY, question, found);
}
