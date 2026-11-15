import { Lang, Trade } from "@gigsync/protocol";
import { type MessageKey, t } from "../i18n/t.js";
import { askable, type InterviewState, type Line, Pick, type Prompt, Slot } from "./card.js";
import { alsoPrompt } from "./card-also.js";
import { minAloud } from "./card-amount.js";
import { arrangementsPrompt, moreRatePrompt, RATE_QUESTION, ratesSummary } from "./card-arrangements.js";
import { asksSummary } from "./card-asks.js";
import { fieldsFor, unlistPrompt, whichRatePrompt } from "./card-edit.js";
import { estimatePrompt } from "./card-estimate.js";
import { filingPrompt } from "./card-guess.js";
import { kindPrompt } from "./card-kind.js";
import { languagesPrompt } from "./card-languages.js";
import { priceUnit, windowsSummary } from "./card-price.js";
import { termsSummary } from "./card-terms.js";
import { restPrompt, workRatesSummary } from "./card-work-rates.js";
import { areaChoices, areaHints, isMessageKey, YES_NO } from "./choices.js";
import type { Field } from "./lexicon.js";

/**
 * The card interview: one question at a time in the owner's language, answered by voice, typing or a tap, parsed by
 * word lists and an amount parser rather than a model ("models propose, code decides"). Pure: no platform calls, so
 * every step runs in vitest. Ends with a spoken summary and an explicit yes; the private minimum is never spoken there.
 */

export { parseAmount } from "./amount.js";
export {
  type AreaChoice,
  askable,
  type CardDraft,
  type Choice,
  draftOf,
  type InterviewConfig,
  type InterviewState,
  isLastSlot,
  type Line,
  Pick as CardPick,
  type Prompt,
  Slot,
  start,
  withConfig,
} from "./card.js";
export { alsoSaid } from "./card-adding.js";
export { arrangementRates, askingArrangement, cardArrangements, mainOf, pickedOf } from "./card-arrangements.js";
export { ASKS_MAX, asksIn } from "./card-asks.js";
export { edit, editSaid, fieldsFor } from "./card-edit.js";
export { cardEstimate, suggestedAmount, withEstimate } from "./card-estimate.js";
export { aboutIsPrivate, choose, hear, keepPlace } from "./card-parse.js";
export {
  AMOUNT_STEP_PAISE,
  keepPrice,
  nearYouLine,
  type PriceAnswer,
  priceArrangements,
  priceUnit,
} from "./card-price.js";
export { legalLines, legalMonthly, rateHint, rateNote } from "./card-rates.js";
export { startWithWork } from "./card-seed.js";
export { ASKED_RADIUS_KM, LAST_END, MOST_HOURS, RADII_KM, withClock, withTerm } from "./card-terms.js";
export { estimateLines, type FoundEstimate } from "./estimate-lines.js";
export { editIntent, type Field, tradesIn } from "./lexicon.js";

/** The chip for each field the owner can change from confirm, labelled as on the My card form. */
const FIELD_LABEL: Readonly<Record<Field, MessageKey>> = {
  trade: "card.what",
  area: "card.where",
  rate: "card.rate",
  min: "card.min",
  languages: "card.languages",
  about: "card.about",
  auto: "card.auto",
  arrangements: "card.arrangements",
  radius: "card.radius",
  hours: "terms.card_clock",
  days: "terms.card_days",
  ask_first: "iv.field_ask_first",
  materials: "terms.card_materials",
  max_hours: "terms.card_hours",
  unlist: "card.unlist",
  same_rate: "card.work_rates",
  asks: "card.asks",
};

/** An area: the place they found, else its catalog name, put in the reader's language when shown, else as the app named it. */
function areaName(state: InterviewState): { names?: Line["names"]; params?: Line["params"] } {
  const key = state.draft.area ?? "";
  const message = `area.${key}`;
  // A place found with the phone's location has its own name, even when it matches a pilot area's.
  const place = state.draft.place?.name;
  if (place) return { params: { area: place } };
  if (isMessageKey(message)) return { names: { area: [message] } };
  return { params: { area: state.config.areas.find((a) => a.key === key)?.names[0] ?? key } };
}

/** The card read back before it goes on the board. The minimum is shown but never spoken. */
function summary(state: InterviewState): Line[] {
  const { draft } = state;
  const area = areaName(state);
  const trades = (draft.trades ?? []).map((tr) => `trade.${tr}` as const);
  const about: Line[] = draft.about ? [{ key: "iv.summary_about", params: { about: draft.about } }] : [];
  // The worker's own skills are their words, not catalog keys: the list is written out in their language (ADR 0047).
  const skills = draft.skills ?? [];
  const work = [...trades.map((k) => t(state.config.own, k)), ...skills.map((k) => k.text)].join(", ");
  const params = { ...area.params, ...(skills.length > 0 ? { trades: work } : {}) };
  return [
    {
      key: "iv.summary",
      ...(Object.keys(params).length > 0 ? { params } : {}),
      names: { ...(skills.length > 0 ? {} : { trades }), ...area.names },
      prices: { rate: draft.rate_paise ?? 0 },
    },
    ...ratesSummary(draft),
    ...workRatesSummary(draft),
    ...termsSummary(state),
    ...windowsSummary(draft),
    ...about,
    ...asksSummary(draft),
    { key: draft.auto ? "iv.summary_auto_on" : "iv.summary_auto_off" },
    { key: "iv.summary_min", prices: { min: draft.limit_paise ?? 0 }, silent: true },
  ];
}

const askYesNo = (own: Lang, lines: Line[]): Prompt => ({
  lines,
  choices: YES_NO,
  hints: [t(own, "flag.yes"), t(own, "flag.no")],
});

/** The question for the field now asked, with its tap choices and the words to expect. */
function question(state: InterviewState): Prompt {
  const { config, draft } = state;
  const own = config.own;
  switch (state.slot) {
    case Slot.trade:
      if (state.filing) return filingPrompt(state);
      if (state.kind) return kindPrompt(state);
      return {
        lines: [{ key: "iv.ask.trade" }],
        choices: Trade.options.map((tr) => ({ value: tr, key: `trade.${tr}` as const })),
        hints: Trade.options.map((tr) => t(own, `trade.${tr}`)),
      };
    case Slot.also:
      return alsoPrompt(state);
    case Slot.area:
      return {
        lines: [{ key: "iv.ask.area" }],
        choices: areaChoices(config.areas, own),
        hints: areaHints(config.areas, own),
      };
    case Slot.rate:
    case Slot.min: {
      // The lowest rate is private: no company's recognizer hears it, and its check is spoken only if it was.
      const min = state.slot === Slot.min;
      const secret = min ? { secret: true as const } : {};
      if (state.pending !== undefined) {
        const quiet = min ? minAloud(state.pendingAloud === true) : {};
        return {
          ...askYesNo(own, [{ key: "iv.check_amount", prices: { price: state.pending }, ...quiet }]),
          ...secret,
        };
      }
      // The price card (`card-price.ts`) carries the going rate; the question stays one line, in the price's unit.
      const unit = priceUnit(draft);
      const ask = min ? "iv.ask.min" : unit ? RATE_QUESTION[unit] : "iv.ask.rate_visit";
      return { lines: [{ key: ask }], numeric: true, hints: [], ...secret };
    }
    case Slot.arrangements:
      return arrangementsPrompt(state);
    case Slot.more_rates: {
      const estimate = estimatePrompt(state);
      const asked = moreRatePrompt(state);
      return estimate ? { ...asked, ...estimate, lines: [...asked.lines, ...estimate.lines], hints: [] } : asked;
    }
    case Slot.languages:
      return languagesPrompt(state);
    case Slot.about:
      return { lines: [{ key: "iv.ask.about" }], choices: [{ value: Pick.skip, key: "iv.skip" }], hints: [] };
    case Slot.ask_first: {
      const item = askable(draft.trades ?? [])[state.ask];
      return askYesNo(own, [{ key: "iv.ask.ask_first", names: { item: item ? [`detail.${item}`] : [] } }]);
    }
    case Slot.auto:
      return askYesNo(own, [{ key: "iv.ask.auto" }]);
    case Slot.confirm:
      if (!state.changing) return askYesNo(own, [...summary(state), { key: "iv.confirm" }]);
      return {
        lines: [...(state.fresh ? summary(state) : []), { key: "iv.what_change" }],
        choices: fieldsFor(state).map((f) => ({ value: f, key: FIELD_LABEL[f] })),
        hints: [],
      };
    case Slot.which_rate:
      return whichRatePrompt(state);
    case Slot.unlist:
      return unlistPrompt();
    default:
      return restPrompt(state);
  }
}

/**
 * Whatever is current: the readback of the last answer, a retry, an amount check, the question, or the summary. A new
 * interview opens by saying what is about to happen; one that starts from a whole card opens on its summary instead.
 */
export function prompt(state: InterviewState): Prompt {
  const ask = question(state);
  const opening: Line[] = state.fresh && state.slot !== Slot.confirm ? [{ key: "iv.start" }] : [];
  return { ...ask, lines: [...opening, ...state.notes, ...ask.lines] };
}
