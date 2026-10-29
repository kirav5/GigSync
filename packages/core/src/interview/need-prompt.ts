import { Trade } from "@gigsync/protocol";
import { type MessageKey, t } from "../i18n/t.js";
import { YES_NO_QUESTIONS } from "../job/details.js";
import { EVERY_DAY, isMonthly } from "../job/when.js";
import { Pick as CardPick, type Choice, type Line, type Prompt } from "./card.js";
import { areaChoices, areaHints, isMessageKey, YES_NO } from "./choices.js";
import {
  DayWord,
  firstQuestion,
  NEED_FIELDS,
  type NeedField,
  NeedSlot,
  type NeedState,
  offered,
  recalled,
  SEARCH_RADII_KM,
} from "./need.js";
import { budgetEstimate } from "./need-estimate.js";
import { NeedPick } from "./need-hear.js";
import { OFFER_CHOICES, recalledLine, redoChoice } from "./need-memory.js";
import { needWords } from "./need-request.js";

/**
 * What the need interview shows and reads aloud now: the question for the field still missing, with its tap choices
 * and the words the recognizer should expect, or the readback before a search. The budget is shown in the readback
 * but never spoken there; workers never see it.
 */

/** The chip for each field the owner can change from the readback. */
const FIELD_LABEL: Readonly<Record<NeedField, MessageKey>> = {
  trade: "need.field_trade",
  detail: "need.field_detail",
  area: "find.area",
  when: "find.when",
  budget: "need.field_budget",
};
/** A day word as the chip and the readback name it. */
const DAY_LABEL: Readonly<Record<string, MessageKey>> = {
  [DayWord.today]: "when.today",
  [DayWord.tomorrow]: "when.tomorrow",
  [EVERY_DAY]: "when.daily",
};
const WHEN_CHOICES: readonly Choice[] = [
  { value: DayWord.today, key: "when.today" },
  { value: DayWord.tomorrow, key: "when.tomorrow" },
  { value: EVERY_DAY, key: "when.daily" },
  { value: NeedPick.date, key: "when.pick" },
];

/** The day as the readback names it: a chip's words, or a date written in the reader's language. */
function dayParts(day: string): Pick<Line, "names" | "dates"> {
  const word = DAY_LABEL[day];
  return word ? { names: { when: [word] } } : { dates: { when: day } };
}

/** The city's usual range for the trade, as a hint under the budget question; none when the card has no band. */
function bandLine(s: NeedState): Line[] {
  const trade = s.draft.trade;
  const band = s.config.rates.bands.find((b) => b.trade === trade);
  if (!band || !trade) return [];
  const key = isMonthly(trade) ? "need.band_month" : "need.band_visit";
  return [{ key, params: { city: s.config.rates.city }, prices: { low: band.low_paise, high: band.high_paise } }];
}

/** The need read back before any search: what, where, when, the words workers read, the detail, and the budget. */
function summary(s: NeedState): Line[] {
  const d = s.draft;
  const area = `area.${d.area ?? ""}`;
  const first = firstQuestion(d.trade);
  const words = needWords(d, s.config.own);
  const detail: Line[] =
    first && d.detail && d.detail !== words
      ? [
          {
            key: "need.summary_detail",
            names: {
              question: [`question.${first}`],
              ...(YES_NO_QUESTIONS.has(first) ? { answer: [d.detail === CardPick.yes ? "flag.yes" : "flag.no"] } : {}),
            },
            ...(YES_NO_QUESTIONS.has(first) ? {} : { params: { answer: d.detail } }),
          },
        ]
      : [];
  const when = dayParts(d.day ?? DayWord.today);
  return [
    {
      key: "need.summary",
      names: { trade: d.trade ? [`trade.${d.trade}`] : [], area: isMessageKey(area) ? [area] : [], ...when.names },
      ...(when.dates ? { dates: when.dates } : {}),
    },
    ...(d.time ? [{ key: "need.summary_time", params: { time: d.time } } as const] : []),
    { key: "need.summary_words", params: { words } },
    ...detail,
    { key: "need.summary_budget", prices: { budget: d.budget_paise ?? 0 }, silent: true },
  ];
}

const yesNoHints = (s: NeedState) => [t(s.config.own, "flag.yes"), t(s.config.own, "flag.no")];

function confirmPrompt(s: NeedState): Prompt {
  if (!s.changing) return { lines: [...summary(s), { key: "need.confirm" }], choices: YES_NO, hints: yesNoHints(s) };
  const fields = NEED_FIELDS.filter((f) => f !== NeedSlot.detail || firstQuestion(s.draft.trade) !== undefined);
  return {
    lines: [{ key: "need.what_change" }],
    choices: fields.map((f) => ({ value: f, key: FIELD_LABEL[f] })),
    hints: [],
  };
}

function detailPrompt(s: NeedState): Prompt {
  const first = firstQuestion(s.draft.trade);
  if (!first) return { lines: [], hints: [] };
  const yesNo = YES_NO_QUESTIONS.has(first);
  return {
    lines: [{ key: `question.${first}` }],
    choices: yesNo ? YES_NO : [{ value: CardPick.skip, key: "iv.skip" }],
    hints: yesNo ? yesNoHints(s) : [],
  };
}

/** "From your last job: … Use it?" in place of the question, when the owner asked to be asked first. */
function offerPrompt(s: NeedState): Prompt | undefined {
  const r = offered(s);
  return r ? { lines: [recalledLine(r, false)], choices: OFFER_CHOICES, hints: yesNoHints(s) } : undefined;
}

/** "I've put …, from your last job." for each question the agent just filled in from memory. */
const filledLines = (s: NeedState): Line[] =>
  s.filled.flatMap((field) => {
    const r = recalled(s, field);
    return r ? [recalledLine(r, true)] : [];
  });

/** A Change chip for each of those, shown under the next question. */
const redoChoices = (s: NeedState): Choice[] =>
  s.filled.map((field) =>
    redoChoice(s.config.own, field === NeedSlot.detail ? firstQuestion(s.draft.trade) : undefined),
  );

function question(s: NeedState): Prompt {
  const own = s.config.own;
  const offer = offerPrompt(s);
  if (offer) return offer;
  switch (s.slot) {
    case NeedSlot.trade:
      return {
        lines: [{ key: s.fresh ? "need.start" : "need.ask.trade" }],
        choices: Trade.options.map((tr) => ({ value: tr, key: `trade.${tr}` as const })),
        hints: Trade.options.map((tr) => t(own, `trade.${tr}`)),
      };
    case NeedSlot.detail:
      return detailPrompt(s);
    case NeedSlot.area:
      return {
        lines: [{ key: "need.ask.area" }],
        choices: areaChoices(s.config.areas),
        hints: areaHints(s.config.areas, own),
      };
    case NeedSlot.when:
      return {
        lines: [{ key: "need.ask.when" }],
        choices: WHEN_CHOICES,
        hints: WHEN_CHOICES.map((c) => t(own, c.key)),
      };
    case NeedSlot.budget: {
      // The estimate, when there is one for this job, in place of the city band; the budget itself stays secret.
      const estimate = budgetEstimate(s);
      const shown = estimate ?? { lines: bandLine(s) };
      return { ...shown, lines: [{ key: "need.ask.budget" }, ...shown.lines], numeric: true, hints: [], secret: true };
    }
    case NeedSlot.confirm:
      return confirmPrompt(s);
    case NeedSlot.done: {
      const area = `area.${s.draft.area ?? ""}`;
      return { lines: [{ key: "need.searching", names: { area: isMessageKey(area) ? [area] : [] } }], hints: [] };
    }
    case NeedSlot.nobody: {
      const wider = SEARCH_RADII_KM.filter((km) => km > s.radius_km);
      return {
        lines: [{ key: "need.nobody", params: { km: s.radius_km } }],
        choices: [
          ...wider.map((km) => ({ value: String(km), key: "find.within_km" as const, params: { km } })),
          { value: NeedPick.change, key: "need.change" },
        ],
        hints: yesNoHints(s),
      };
    }
    default:
      return { lines: [], hints: [] };
  }
}

/** Whatever is current: the notes (a retry, a readback, what memory filled in), then the question. */
export function needPrompt(s: NeedState): Prompt {
  const ask = question(s);
  const redo = redoChoices(s);
  const choices = redo.length > 0 ? { choices: [...redo, ...(ask.choices ?? [])] } : {};
  return { ...ask, lines: [...s.notes, ...filledLines(s), ...ask.lines], ...choices };
}
