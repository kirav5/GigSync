import { Lang, ModelPurpose } from "@gigsync/protocol";
import { z } from "zod";
import { priceText } from "../i18n/reasons.js";
import { dateText, t } from "../i18n/t.js";
import type { Line } from "../interview/card.js";
import { firstObject, MODEL_WAIT_MS, within } from "../interview/need-model.js";
import { checkExplanation, EXPLAIN_MAX } from "../job/explain-model.js";
import { log } from "../log.js";
import type { Model } from "../ports.js";

const Purpose = ModelPurpose.enum;

/**
 * A model may word the work outlook for the owner (the facts are built by code, `outlook.ts`). Its text is kept only
 * when it passes the same checker as an offer's explanation (ADR 0033 §4): short, in the owner's script, and every
 * number in it one of the outlook's. It may not name a place the outlook does not: every capitalised word past the
 * start of a sentence must be in the outlook. That check needs capitals, so only English is worded by a model; Hindi
 * and Kannada readers get the outlook's own lines, as does everyone when the text fails or no model answers in time.
 */

/** Room for three short sentences as JSON. */
const MAX_TOKENS = 200;
/** The languages a model may word an outlook in: those whose script marks names with capitals. */
const WORDED: ReadonlySet<Lang> = new Set([Lang.enum.en]);
const Reply = z.object({ text: z.string().min(1).max(EXPLAIN_MAX) });
/** A capitalised word that does not start a sentence: a name, as English writes one. */
const NAME_INSIDE = /(?<![.!?:]\s|^)\b\p{Lu}[\p{L}'-]*/gu;
/** A day written `YYYY-MM-DD` is read at local noon, so no time zone moves it to another day. */
const NOON = "T12:00:00";

/** A line as text in the owner's language: prices as rupees, names and dates in that language, as Talk shows it. */
export function lineString(lang: Lang, line: Line): string {
  const prices = Object.entries(line.prices ?? {}).map(([name, paise]) => [name, priceText(paise)]);
  const names = Object.entries(line.names ?? {}).map(([name, keys]) => [name, keys.map((k) => t(lang, k)).join(", ")]);
  const dates = Object.entries(line.dates ?? {}).map(([name, day]) => [name, dateText(lang, new Date(day + NOON))]);
  return t(lang, line.key, { ...line.params, ...Object.fromEntries([...prices, ...names, ...dates]) });
}

/** The words a model may use: the outlook's own sentences, as the template it rewords. */
const outlookTemplate = (lang: Lang, lines: readonly Line[]): string =>
  lines.map((line) => lineString(lang, line)).join(" ");

/** True when every name in the text is one the template already says. */
export function namesOnlyFrom(text: string, template: string): boolean {
  return (text.match(NAME_INSIDE) ?? []).every((name) => template.includes(name));
}

function outlookPrompt(template: string): string {
  return [
    "Reword this note for a worker moving to a new city for work, in plain English.",
    "Two or three short sentences. Keep every amount and number exactly as written.",
    "Add no other number, place, advice or promise.",
    `Note: ${JSON.stringify(template)}`,
    'Reply with JSON only: {"text": "..."}',
  ].join("\n");
}

function parseText(reply: string): string | undefined {
  const object = firstObject(reply);
  if (!object) return undefined;
  try {
    return Reply.safeParse(JSON.parse(object)).data?.text.trim();
  } catch {
    return undefined;
  }
}

/** The model's wording of the outlook when it passes every check; undefined means the outlook's own lines are shown. */
export async function phraseOutlook(
  model: Model | undefined,
  lines: readonly Line[],
  lang: Lang,
  waitMs = MODEL_WAIT_MS,
): Promise<string | undefined> {
  if (!model || !WORDED.has(lang) || lines.length === 0) return undefined;
  const template = outlookTemplate(lang, lines);
  try {
    const reply = await within(
      model.generate(outlookPrompt(template), { maxTokens: MAX_TOKENS, purpose: Purpose.moving_outlook }),
      waitMs,
    );
    const text = reply ? parseText(reply) : undefined;
    if (!text || !checkExplanation(text, { template, lang }) || !namesOnlyFrom(text, template)) return undefined;
    return text;
  } catch (err) {
    log.warn("outlook wording failed", { error: err instanceof Error ? err.name : String(err) });
    return undefined;
  }
}
