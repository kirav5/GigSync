import type { City, EstimateRequest, Lang } from "@gigsync/protocol";
import { priceText } from "../i18n/reasons.js";
import { dateText, type MessageKey, t } from "../i18n/t.js";
import type { Line } from "../interview/card.js";
import { isMessageKey } from "../interview/choices.js";
import { estimateLines, type FoundEstimate } from "../interview/estimate-lines.js";
import { MODEL_WAIT_MS, within } from "../interview/need-model.js";
import { checkExplanation, ExplainedBy, type Explanation, LANGUAGE_NAME, replyText } from "../job/explain-model.js";
import { log } from "../log.js";
import type { Model } from "../ports.js";
import type { MarketQuestion } from "../router/market.js";
import { areaSlug } from "./areas.js";
import { estimateRequest } from "./scope.js";

/**
 * The answer to a market question in the chat (ADR 0039 §2). The facts are built by code from the server's estimate
 * (the same route the rate and budget questions use): the range for the trade and job size, what it rests on (jobs on
 * GigSync and the area or city, or web sources), and the legal minimum. A model may word them in the owner's language;
 * its text is kept only when every number in it is one of the facts' (as ADR 0033 checks an offer's explanation), else
 * the owner reads the template sentences.
 */

/** Room for three short sentences as JSON. */
const MAX_TOKENS = 200;
const SENTENCE_GAP = " ";
const NAME_LIST = ", ";
const DAY_START = "T00:00:00";

/** The estimate request a market question asks: its trade and size, in its area when it names one, in `city`. */
export const marketRequest = (city: City, q: MarketQuestion): EstimateRequest | undefined =>
  estimateRequest(city, q.trade, q.details, q.area ? areaSlug(q.area) : undefined);

/** The area the question named, else the city: where "no estimate" says it looked. */
function placeKey(city: City, q: MarketQuestion): MessageKey[] {
  const key = q.area ? `area.${q.area}` : `city.${city}`;
  return isMessageKey(key) ? [key] : [];
}

/** The answer's facts as lines: the estimate's own, or that there is none yet for that trade and place. */
export function marketLines(own: Lang, city: City, q: MarketQuestion, found: FoundEstimate | undefined): Line[] {
  if (found) return estimateLines(own, found);
  return [{ key: "estimate.market_none", names: { trade: [`trade.${q.trade}`], place: placeKey(city, q) } }];
}

/** A line as one sentence in the owner's language: prices as rupees, names and dates in that language. */
export function lineSentence(own: Lang, line: Line): string {
  const prices = Object.fromEntries(Object.entries(line.prices ?? {}).map(([k, paise]) => [k, priceText(paise)]));
  const names = Object.fromEntries(
    Object.entries(line.names ?? {}).map(([k, keys]) => [k, keys.map((key) => t(own, key)).join(NAME_LIST)]),
  );
  const dates = Object.fromEntries(
    Object.entries(line.dates ?? {}).map(([k, day]) => [k, dateText(own, new Date(`${day}${DAY_START}`))]),
  );
  return t(own, line.key, { ...line.params, ...prices, ...names, ...dates });
}

/** Short and JSON-only: the facts as the template says them, to reword without adding anything. */
export function marketPrompt(template: string, own: Lang): string {
  return [
    `Reword this answer about what a kind of work usually costs, for a worker or a household, in ${LANGUAGE_NAME[own]}.`,
    "Two or three short, plain sentences. Keep every amount and count exactly as written, and say what the range is",
    "based on and where. Add no other number, advice or promise.",
    `Answer: ${JSON.stringify(template)}`,
    'Reply with JSON only: {"text": "..."}',
  ].join("\n");
}

/** The answer: the model's wording when it passes the checker, else the template sentences. */
export async function wordMarket(
  model: Model | undefined,
  own: Lang,
  lines: readonly Line[],
  waitMs = MODEL_WAIT_MS,
): Promise<Explanation> {
  const template = lines.map((l) => lineSentence(own, l)).join(SENTENCE_GAP);
  const fallback: Explanation = { text: template, by: ExplainedBy.template };
  if (!model) return fallback;
  try {
    const reply = await within(model.generate(marketPrompt(template, own), { maxTokens: MAX_TOKENS }), waitMs);
    const text = reply ? replyText(reply) : undefined;
    if (!text || !checkExplanation(text, { template, lang: own })) return fallback;
    return { text, by: ExplainedBy.model };
  } catch (err) {
    log.warn("market answer wording failed", { error: err instanceof Error ? err.name : String(err) });
    return fallback;
  }
}
