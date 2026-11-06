import { Arrangement, Lang, PAISE_PER_RUPEE, Trade } from "@gigsync/protocol";
import { z } from "zod";
import { asciiDigits, numbersIn } from "../job/details.js";
import { log } from "../log.js";
import type { Model } from "../ports.js";
import { parseAmount } from "./amount.js";
import type { AreaChoice } from "./card.js";
import { areaIn } from "./lexicon.js";
import { DETAIL_MAX, TIME_MAX, timeIn } from "./need-parse.js";
import { normalize } from "./normalize.js";
import type { ScopeChip } from "./scope-read.js";

/**
 * A model's help reading a need ("models propose, code decides"): when the phone has one and the owner writes in
 * English, it is asked what one sentence says, and every value it returns is checked against what the app allows.
 * It fills only what the word lists left empty. It may infer the trade from the problem ("sink blocked" is a plumber),
 * but it may only read, never guess, the rest: an area or a time counts only when the owner's words name it, a budget
 * only when it is a number they said. It is not asked the day: small models answer "today" when no day was said, and
 * a guessed day would skip the question. It may say how such work is usually hired (by the hour, once, some days a
 * week, by the month), which narrows the chips for work outside the trades (ADR 0051) and never answers the question.
 * Without a model, or when it says anything else, nothing changes.
 */

/** What a model read from a sentence, each value already checked. */
export interface NeedHint {
  trade?: Trade;
  /** An area key. */
  area?: string;
  time?: string;
  budget_paise?: number;
  /** The sentence says what is wrong: the owner's own words answer the problem question. */
  problem?: true;
  /** The kind of job the words sound like (`problemByMeaning`), a value of the trade's problem driver. */
  problemKind?: string;
  /** The job's scope read from the words (`readScope`), each value already grounded in them. */
  scope?: readonly ScopeChip[];
  /** ADR 0051: the ways such work is usually hired, each an arrangement; a suggestion for the chips, never an answer. */
  fits?: readonly Arrangement[];
}

/** The on-device models read and answer English only today (HLD 7.6). */
const MODEL_LANG = Lang.enum.en;
/** A small model's answer is short; anything longer is not the object asked for. The arrangements list adds ~30. */
const MAX_TOKENS = 160;
/** How long the owner waits for the model before the interview carries on without it. */
export const MODEL_WAIT_MS = 8000;
/** No household budget in the pilot comes near this. */
const MAX_BUDGET_RUPEES = 1_000_000;
const AREA_TEXT_MAX = 60;
const GROUPING = /(?<=\d),(?=\d)/g;
const DIGIT = /\d/;
const OPEN = "{";
const CLOSE = "}";
const QUOTE = '"';
const ESCAPE = "\\";

/** Each field on its own: one the model got wrong is dropped, the rest still count. */
const Reply = z.object({
  trade: Trade.nullish().catch(null),
  area: z.string().max(AREA_TEXT_MAX).nullish().catch(null),
  time: z.string().max(TIME_MAX).nullish().catch(null),
  // Small models often quote numbers ("9000"); the value is checked against the owner's words either way.
  budget_rupees: z.coerce.number().int().positive().max(MAX_BUDGET_RUPEES).nullish().catch(null),
  problem: z.string().max(DETAIL_MAX).nullish().catch(null),
  how_long: z.array(z.string()).max(Arrangement.options.length).nullish().catch(null),
});
type Reply = z.infer<typeof Reply>;

/** Short and JSON-only, with the allowed values listed, so a small model can follow it. */
export function needModelPrompt(text: string, areas: readonly AreaChoice[]): string {
  const or = (values: readonly string[]) => values.map((v) => JSON.stringify(v)).join(" | ");
  return [
    "Read this request for help at home. Reply with one JSON object and nothing else.",
    `{"trade": ${or(Trade.options)} | null, "area": ${or(areas.map((a) => a.key))} | null,`,
    ' "time": the time words they used | null,',
    ' "budget_rupees": the most they said they will pay, as a number | null, "problem": what is wrong | null,',
    ` "how_long": how such work is usually hired, a list of ${or(Arrangement.options)} | null}`,
    `Request: ${JSON.stringify(text)}`,
  ].join("\n");
}

/** The first whole {...} object in a reply, wherever it stands: models wrap it in fences or prose. */
export function firstObject(reply: string): string | undefined {
  const start = reply.indexOf(OPEN);
  if (start < 0) return undefined;
  let depth = 0;
  let quoted = false;
  for (let i = start; i < reply.length; i++) {
    const ch = reply[i];
    if (quoted) {
      if (ch === ESCAPE) i++;
      else if (ch === QUOTE) quoted = false;
    } else if (ch === QUOTE) quoted = true;
    else if (ch === OPEN) depth++;
    else if (ch === CLOSE && --depth === 0) return reply.slice(start, i + 1);
  }
  return undefined;
}

function parseReply(reply: string): Reply | undefined {
  const object = firstObject(reply);
  if (!object) return undefined;
  try {
    const parsed = Reply.safeParse(JSON.parse(object));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/** A budget the owner actually said: the model may read the owner's number, never choose one. */
function stated(text: string, rupees: number): boolean {
  return numbersIn(text.replace(GROUPING, "")).includes(rupees) || parseAmount(text) === rupees * PAISE_PER_RUPEE;
}

/** Words that say a time: a number ("after 5") or a time of day the word lists know, not any words the owner said. */
const isTime = (words: string): boolean => DIGIT.test(asciiDigits(words)) || timeIn(words) !== undefined;

/** The model's values that pass every check against the owner's words and the app's lists. */
function checked(reply: Reply, text: string, areas: readonly AreaChoice[]): NeedHint {
  // The owner's own words must name the area, if only misspelled ("koramangla"); a model's guess does not count.
  const named = areaIn(text, areas);
  const meant = reply.area ? (areas.find((a) => a.key === reply.area)?.key ?? areaIn(reply.area, areas)) : undefined;
  const area = meant !== undefined && meant === named ? meant : undefined;
  const time = reply.time?.trim();
  const said = normalize(text);
  const rupees = reply.budget_rupees;
  const fits = Arrangement.options.filter((a) => reply.how_long?.includes(a));
  return {
    ...(reply.trade ? { trade: reply.trade } : {}),
    ...(area ? { area } : {}),
    ...(time && said.includes(normalize(time)) && isTime(time) ? { time } : {}),
    ...(rupees && stated(text, rupees) ? { budget_paise: rupees * PAISE_PER_RUPEE } : {}),
    ...(reply.problem?.trim() ? { problem: true as const } : {}),
    ...(fits.length > 0 ? { fits } : {}),
  };
}

/** The model's answer, or null once `ms` have passed; the timer never outlives the answer. */
export async function within(answer: Promise<string | null>, ms: number): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      log.warn("model gave no answer in time", { ms });
      resolve(null);
    }, ms);
  });
  try {
    return await Promise.race([answer, late]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What a model reads from one sentence about a need, checked; empty without a model, for a language other than
 * English, when it takes longer than `waitMs`, or when its answer is not the object asked for.
 */
export async function understandNeed(
  model: Model,
  text: string,
  { areas, lang, waitMs = MODEL_WAIT_MS }: { areas: readonly AreaChoice[]; lang: Lang; waitMs?: number },
): Promise<NeedHint> {
  if (lang !== MODEL_LANG || !text.trim()) return {};
  try {
    const reply = await within(model.generate(needModelPrompt(text, areas), { maxTokens: MAX_TOKENS }), waitMs);
    const parsed = reply ? parseReply(reply) : undefined;
    return parsed ? checked(parsed, text, areas) : {};
  } catch {
    return {};
  }
}
