import {
  type Explanation,
  type MarketQuestion,
  type Model,
  marketLines,
  marketQuestion,
  marketRequest,
  wordMarket,
} from "@gigsync/core";
import type { Lang, Session, Trade } from "@gigsync/protocol";
import { needConfig } from "../card/choices.js";
import { phoneDay } from "../screens/jobGroups.js";
import { PILOT_CITY } from "../ui/places.js";
import { fetchEstimate } from "./useEstimate.js";

/**
 * Market questions in Talk and Find (ADR 0039 §2): "what do cooks charge in Jayanagar?" answered from the same
 * estimate route as the rate and budget questions, in the area named (else the city), worded by the phone's model when
 * its numbers check, else by the template.
 */

/** The market question the owner's words ask, read against the pilot's areas; `own` is a worker's own trade. */
export function heardMarket(text: string, lang: Lang, now: Date, own?: Trade): MarketQuestion | undefined {
  const { areas, today } = needConfig(lang, phoneDay(now));
  return marketQuestion(text, lang, { areas, today, ...(own ? { own } : {}) });
}

/** The answer to a market question, in the owner's language. Never fails: no estimate is an answer too. */
export async function answerMarket(
  session: Session,
  model: Model,
  lang: Lang,
  question: MarketQuestion,
): Promise<Explanation> {
  const request = marketRequest(PILOT_CITY, question);
  const found = request ? await fetchEstimate(session, request) : undefined;
  return wordMarket(model, lang, marketLines(lang, PILOT_CITY, question, found));
}
