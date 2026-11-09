import { DriverKind, DriverName, driverSpec, type Lang, Trade } from "@gigsync/protocol";
import { type MessageKey, type PluralKey, pluralKey, t } from "../i18n/t.js";
import type { Choice, Line, Prompt } from "./card.js";
import { awaitingModel, currentQuestion, modelLed } from "./driver-ask.js";
import { driverAnswer, saysDontKnow } from "./driver-parse.js";
import { scrubFacts } from "./fact-scrub.js";
import { isSkip, yesNo } from "./lexicon.js";
import { moveOn, type NeedDraft, NeedSlot, type NeedState, retryNeed } from "./need.js";
import { DETAIL_MAX } from "./need-parse.js";
import type { PriceContext, PriceQuestion, PriceStep } from "./price-model.js";

/**
 * The need interview's price questions (ADR 0041 §2, ADR 0058): the fixed drivers', worded from the catalog, or for
 * work outside the trades the model's, checked; a driver's answer chips always come from code, and "I don't know" is
 * always one of them. An answer is read on the phone; only structured values and scrubbed facts leave it. "I don't
 * know" or skip ends the questions.
 */

/** What a question fills, as `PriceFill` names it. */
const Fill = { driver: "driver", fact: "fact" } as const;

/** What a price question's taps carry: a value (`set` then the value), a fact choice (`fact` then its index), or none. */
export const DriverPick = { set: "driver:", fact: "fact:", dontKnow: "driver_dont_know" } as const;

/** Counts offered as chips per count driver; any other number can be typed or said. */
const COUNT_CHOICES: Readonly<Partial<Record<DriverName, readonly number[]>>> = {
  area_sqft: [600, 1000, 1500, 2000, 3000],
  rooms: [1, 2, 3, 4],
  floors: [1, 2, 3],
  people: [1, 2, 3, 4, 5],
  meals: [1, 2, 3],
  days_week: [5, 6, 7],
  hours: [4, 6, 8, 10],
  points: [1, 2, 3, 5],
};
const COUNT_LABEL: Readonly<Partial<Record<DriverName, PluralKey>>> = {
  rooms: "driver.n.rooms",
  floors: "driver.n.floors",
  people: "driver.n.people",
  meals: "driver.n.meals",
  days_week: "driver.n.days_week",
  hours: "driver.n.hours",
  points: "driver.n.points",
};
const AREA_LABEL: MessageKey = "driver.n.area_sqft";
const AGAIN: MessageKey = "need.again";
/** A line of the model's own words. */
const WORDS: MessageKey = "estimate.answer";
/** Enough of the owner's own words for the model to know the job. */
const WORDS_MAX = 500;
export const DONT_KNOW: Choice = { value: DriverPick.dontKnow, key: "driver.dont_know" };

/** The count question is worded per repair trade: an electrician's points are switches, a carpenter's are doors. */
const POINTS_BY_TRADE: ReadonlySet<Trade> = new Set([
  Trade.enum.electrician,
  Trade.enum.plumber,
  Trade.enum.carpenter,
  Trade.enum.ac_technician,
]);

const askKey = (name: DriverName, trade: Trade | undefined): MessageKey =>
  name === DriverName.enum.points && trade && POINTS_BY_TRADE.has(trade)
    ? (`driver.ask.points.${trade}` as MessageKey)
    : (`driver.ask.${name}` as MessageKey);

/** One chip for a driver's value, in the owner's language. */
export function driverChoice(lang: Lang, name: DriverName, value: string | number): Choice {
  const pick = `${DriverPick.set}${value}`;
  if (typeof value === "number") {
    const plural = COUNT_LABEL[name];
    return { value: pick, key: plural ? pluralKey(lang, plural, value) : AREA_LABEL, params: { count: value } };
  }
  return { value: pick, key: `driver.value.${name}.${value}` as MessageKey };
}

/** The chips for a question: a driver's values from code, or the model's fact choices; then "I don't know". */
function choicesOf(s: NeedState, q: PriceQuestion): Choice[] {
  if (Fill.fact in q.fills)
    return [
      ...(q.choices ?? []).map((text, i) => ({ value: `${DriverPick.fact}${i}`, key: WORDS, params: { text } })),
      DONT_KNOW,
    ];
  const name = q.fills.driver;
  const spec = s.draft.trade ? driverSpec(s.draft.trade, name) : undefined;
  const values = spec?.kind === DriverKind.choice ? spec.values : (COUNT_CHOICES[name] ?? []);
  return [...values.map((v) => driverChoice(s.config.own, name, v)), DONT_KNOW];
}

/**
 * The model is to be asked now: the price question is the one open. Open price questions come after the address, so
 * asking earlier wrote a question nobody could see yet and put the address question on screen a second time.
 */
export const askingModel = (s: Pick<NeedState, "slot" | "draft">): boolean =>
  s.slot === NeedSlot.driver && awaitingModel(s.draft);

/** The question now: the catalog's for a fixed driver, or the model's words; a wait line while the model thinks. */
export function driverQuestion(s: NeedState): Prompt {
  if (awaitingModel(s.draft)) return { lines: [{ key: "driver.thinking" }], hints: [] };
  const q = currentQuestion(s.draft);
  if (!q) return { lines: [], hints: [] };
  const line: Line = q.text
    ? { key: WORDS, params: { text: q.text } }
    : Fill.driver in q.fills
      ? { key: askKey(q.fills.driver, s.draft.trade) }
      : { key: WORDS, params: { text: q.fills.fact } };
  const choices = choicesOf(s, q);
  return { lines: [line], choices, hints: choices.map((c) => t(s.config.own, c.key, c.params)) };
}

/** The question's words as the model reads them back. */
const questionText = (s: NeedState, q: PriceQuestion): string =>
  q.text ?? (Fill.driver in q.fills ? t(s.config.own, askKey(q.fills.driver, s.draft.trade)) : q.fills.fact);

/** The facts with one more answer, under the question's label: code keeps it, so no second model call is needed. */
const factsWith = (d: NeedDraft, q: PriceQuestion, value: string | number) =>
  Fill.fact in q.fills ? scrubFacts([...(d.facts ?? []), { label: q.fills.fact, value: String(value) }]) : d.facts;

/** The draft after an answer: a value or a fact's words, one more question asked; the model's next one if it wrote any. */
function answered(s: NeedState, q: PriceQuestion, value: string | number): NeedDraft {
  const d = s.draft;
  const asked = (d.askedDrivers ?? 0) + 1;
  const drivers = Fill.driver in q.fills ? { ...d.drivers, [q.fills.driver]: value } : d.drivers;
  const [current, ...next] = d.modelAsk?.next ?? [];
  const modelAsk = d.modelAsk && {
    ...d.modelAsk,
    current,
    next,
    said: [...d.modelAsk.said, { q: questionText(s, q), a: String(value) }],
  };
  const done = modelLed(d) && !current;
  return {
    ...d,
    drivers,
    facts: factsWith(d, q, value),
    askedDrivers: asked,
    modelAsk,
    priceDone: d.priceDone || done,
  };
}

/** "I don't know" or skip: the questions end; a driver asked about is assumed. */
function ended(d: NeedDraft, q: PriceQuestion): NeedDraft {
  const notKnown = Fill.driver in q.fills ? [...(d.notKnown ?? []), q.fills.driver] : d.notKnown;
  return { ...d, notKnown, priceDone: true, modelAsk: d.modelAsk && { ...d.modelAsk, current: undefined, next: [] } };
}

/** A tap at a price question; undefined for a value it did not offer. */
export function chooseDriver(s: NeedState, value: string): NeedState | undefined {
  const q = currentQuestion(s.draft);
  const trade = s.draft.trade;
  if (!q) return undefined;
  if (value === DriverPick.dontKnow) return moveOn(s, ended(s.draft, q));
  if (Fill.fact in q.fills) {
    const choice = value.startsWith(DriverPick.fact)
      ? q.choices?.[Number(value.slice(DriverPick.fact.length))]
      : undefined;
    return choice === undefined ? undefined : moveOn(s, answered(s, q, choice));
  }
  if (!trade || !value.startsWith(DriverPick.set)) return undefined;
  const picked = driverAnswer(trade, q.fills.driver, value.slice(DriverPick.set.length));
  return picked && "value" in picked ? moveOn(s, answered(s, q, picked.value)) : undefined;
}

/** "Skip" said as such; a plain "no" is an answer to a yes-or-no question, not a skip. */
const skipped = (text: string): boolean => isSkip(text) && yesNo(text) !== false;

/** Words at a price question: the value or the fact's words, or "I don't know" / skip; else the question again. */
export function hearDriver(s: NeedState, text: string, draft: NeedDraft = s.draft): NeedState {
  const q = currentQuestion(s.draft);
  if (!q) return moveOn(s, draft);
  const next: NeedState = { ...s, draft };
  if (saysDontKnow(text) || skipped(text)) return moveOn(s, ended(draft, q));
  if (Fill.fact in q.fills) {
    const words = text.trim();
    return words && words.length <= DETAIL_MAX ? moveOn(s, answered(next, q, words)) : retryNeed(s, { key: AGAIN });
  }
  const answer = s.draft.trade ? driverAnswer(s.draft.trade, q.fills.driver, text) : undefined;
  if (answer && "value" in answer) return moveOn(s, answered(next, q, answer.value));
  return isSkip(text) ? moveOn(s, ended(draft, q)) : { ...retryNeed(s, { key: AGAIN }), draft };
}

/** What the model is told when it writes the questions. */
export function priceContext(s: NeedState): PriceContext {
  const d = s.draft;
  return {
    lang: s.config.own,
    jobType: d.jobType,
    words: [d.need, typeof d.detail === "string" ? d.detail : undefined].filter(Boolean).join(" ").slice(0, WORDS_MAX),
  };
}

/** The model's questions taken: the first one open and the rest waiting; none ends them, and a failure goes without. */
export function withPriceStep(s: NeedState, step: PriceStep): NeedState {
  const d = s.draft;
  if (!d.modelAsk || !awaitingModel(d)) return s;
  if ("failed" in step) return moveOn(s, { ...d, modelAsk: undefined });
  const [current, ...next] = step.questions;
  if (!current) return moveOn(s, { ...d, priceDone: true });
  return moveOn(s, { ...d, modelAsk: { ...d.modelAsk, current, next } });
}
