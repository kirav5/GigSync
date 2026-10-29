import { DetailFlag, Trade } from "@gigsync/protocol";
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
  SEARCH_RADII_KM,
} from "./need.js";
import { NeedPick, rememberedDetail } from "./need-hear.js";
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

/** "Same as last time: …" for the trade's first question, when the agent remembers the owner's answer. */
function sameDetail(s: NeedState): Choice[] {
  const value = rememberedDetail(s);
  if (!value) return [];
  const flag = DetailFlag.safeParse(value);
  const shown = flag.success ? t(s.config.own, `flag.${flag.data}`) : value;
  return [{ value: NeedPick.remembered, key: "memory.same_value", params: { value: shown } }];
}

function detailPrompt(s: NeedState): Prompt {
  const first = firstQuestion(s.draft.trade);
  if (!first) return { lines: [], hints: [] };
  const yesNo = YES_NO_QUESTIONS.has(first);
  return {
    lines: [{ key: `question.${first}` }],
    choices: [...sameDetail(s), ...(yesNo ? YES_NO : [{ value: CardPick.skip, key: "iv.skip" } as const])],
    hints: yesNo ? yesNoHints(s) : [],
  };
}

/** "Same as last time (area)" first among the areas, when the agent remembers one the catalog still has. */
function sameArea(s: NeedState): Choice[] {
  const area = s.config.remembered?.area;
  const key = `area.${area ?? ""}`;
  if (!area || !s.config.areas.some((a) => a.key === area) || !isMessageKey(key)) return [];
  return [{ value: area, key: "memory.same_area", params: { area: t(s.config.own, key) } }];
}

function question(s: NeedState): Prompt {
  const own = s.config.own;
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
        choices: [...sameArea(s), ...areaChoices(s.config.areas)],
        hints: areaHints(s.config.areas, own),
      };
    case NeedSlot.when:
      return {
        lines: [{ key: "need.ask.when" }],
        choices: WHEN_CHOICES,
        hints: WHEN_CHOICES.map((c) => t(own, c.key)),
      };
    case NeedSlot.budget:
      return { lines: [{ key: "need.ask.budget" }, ...bandLine(s)], numeric: true, hints: [], secret: true };
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

/** Whatever is current: the notes (a retry, a readback, why a search failed), then the question. */
export function needPrompt(s: NeedState): Prompt {
  const ask = question(s);
  return { ...ask, lines: [...s.notes, ...ask.lines] };
}
