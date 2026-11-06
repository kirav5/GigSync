import { DriverKind, DriverName, driverSpec, type Lang, Trade } from "@gigsync/protocol";
import { type MessageKey, type PluralKey, pluralKey, t } from "../i18n/t.js";
import type { Choice, Line, Prompt } from "./card.js";
import { awaitingModel, currentQuestion, draftDrivers, topDriver } from "./driver-ask.js";
import { driverAnswer, saysDontKnow } from "./driver-parse.js";
import { isSkip, yesNo } from "./lexicon.js";
import { moveOn, type NeedDraft, NeedSlot, type NeedState, retryNeed } from "./need.js";
import { DETAIL_MAX } from "./need-parse.js";
import { MAX_PRICE_QUESTIONS, type PriceContext, type PriceQuestion, type PriceStep } from "./price-model.js";

/**
 * The need interview's price questions (ADR 0041 §2): the model's, checked, or the fixed drivers', worded from the
 * catalog; a driver's answer chips always come from code, and "I don't know" is always one of them. An answer is read
 * on the phone; only structured values and scrubbed facts leave it. "I don't know" or skip ends the questions.
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
const DONT_KNOW: Choice = { value: DriverPick.dontKnow, key: "driver.dont_know" };

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

/** The question now: the model's words, or the catalog's for a fixed driver; a wait line while the model thinks. */
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

/** The draft after an answer: a value or a fact's words, one more question asked; the model asked next if it leads. */
function answered(s: NeedState, q: PriceQuestion, value: string | number): NeedDraft {
  const d = s.draft;
  const asked = (d.askedDrivers ?? 0) + 1;
  const drivers = Fill.driver in q.fills ? { ...d.drivers, [q.fills.driver]: value } : d.drivers;
  const modelAsk = d.modelAsk && {
    ...d.modelAsk,
    current: undefined,
    said: [...d.modelAsk.said, { q: questionText(s, q), a: String(value) }],
  };
  return { ...d, drivers, askedDrivers: asked, modelAsk };
}

/** "I don't know" or skip: the questions end; a driver asked about is assumed. */
function ended(d: NeedDraft, q: PriceQuestion): NeedDraft {
  const notKnown = Fill.driver in q.fills ? [...(d.notKnown ?? []), q.fills.driver] : d.notKnown;
  return { ...d, notKnown, priceDone: true, modelAsk: d.modelAsk && { ...d.modelAsk, current: undefined } };
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

/** What the phone's model is told for the next step. */
export function priceContext(s: NeedState): PriceContext {
  const d = s.draft;
  return {
    lang: s.config.own,
    trade: d.trade,
    jobType: d.jobType,
    words: [d.need, typeof d.detail === "string" ? d.detail : undefined].filter(Boolean).join(" ").slice(0, WORDS_MAX),
    drivers: draftDrivers(d),
    notKnown: d.notKnown ?? [],
    said: d.modelAsk?.said ?? [],
    asked: d.askedDrivers ?? 0,
  };
}

/** The safeguard: the job's top driver as a fixed question, when the model has not covered it and there is room. */
function safeguard(d: NeedDraft, top: DriverName | undefined): PriceQuestion | undefined {
  const covered = d.modelAsk?.covered ?? [];
  const open = top !== undefined && draftDrivers(d)[top] === undefined && !(d.notKnown ?? []).includes(top);
  return open && !covered.includes(top) && (d.askedDrivers ?? 0) < MAX_PRICE_QUESTIONS
    ? { fills: { driver: top } }
    : undefined;
}

/**
 * The model's step taken: its question (or, as the last one, the job's top driver if it was never asked), done
 * (unless the top driver still needs asking), or failed, which hands the rest to the fixed questions. The top driver is
 * the one ranked first when the model began, so the guarantee is one driver per job, not a moving target. Facts
 * replace those before.
 */
export function withPriceStep(s: NeedState, step: PriceStep): NeedState {
  const d = s.draft;
  if (!d.modelAsk || !awaitingModel(d)) return s;
  if ("failed" in step) return moveOn(s, { ...d, modelAsk: undefined });
  const top = d.modelAsk.top ?? topDriver(d);
  const ask = { ...d.modelAsk, top };
  const facts = step.facts.length > 0 ? step.facts : d.facts;
  const last = (d.askedDrivers ?? 0) === MAX_PRICE_QUESTIONS - 1;
  const guard = safeguard(d, top);
  const fromModel = "question" in step ? step.question : undefined;
  const coversTop = fromModel && Fill.driver in fromModel.fills && fromModel.fills.driver === top;
  const current = fromModel && (!last || coversTop || !guard) ? fromModel : guard;
  if (!current) return moveOn(s, { ...d, facts, priceDone: true, modelAsk: { ...ask, current: undefined } });
  const covered = Fill.driver in current.fills ? [...ask.covered, current.fills.driver] : ask.covered;
  return moveOn(s, { ...d, facts, modelAsk: { ...ask, current, covered } });
}
