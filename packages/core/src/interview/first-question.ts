import type { Lang, QuestionKey } from "@gigsync/protocol";
import { ModelPurpose } from "@gigsync/protocol";
import { z } from "zod";
import { t } from "../i18n/t.js";
import { langOf, questionProblem } from "../job/guard.js";
import type { Model } from "../ports.js";
import { NeedSlot, type NeedState } from "./need.js";
import { firstObject, MODEL_WAIT_MS, within } from "./need-model.js";

const Purpose = ModelPurpose.enum;

/**
 * The first question after a kind of work is picked from the list (ADR 0061): with no words to read, the model words
 * it for that work ("What's wrong with your TV?"), in the owner's language, so a tap is not met with a form. It fills
 * the same detail the fixed question fills, so a trade's estimate reads the answer as before. Checked like every
 * model question; without one in time, the fixed question is asked.
 */

const MAX_TOKENS = 60;
const MAX_CHARS = 140;
const LANG_NAME: Readonly<Record<Lang, string>> = { en: "English", hi: "Hindi", kn: "Kannada" };
const Reply = z.object({ question: z.string() });
const SCHEMA = { type: "object", properties: { question: { type: "string" } }, required: ["question"] } as const;

export function firstQuestionPrompt(work: string, key: QuestionKey, lang: Lang): string {
  return [
    `A household in India picked "${work}" from a list of work, and said nothing else. Reply with one JSON object only.`,
    `Write the first question to ask them, in ${LANG_NAME[lang]}: one short question, in plain words, that finds out what exactly they need from this work.`,
    `It asks what this asks, fitted to the work: ${JSON.stringify(t(lang, `question.${key}`))}. Never ask about money, phone, address or names.`,
    '{"question": "...?"}',
  ].join("\n");
}

/** The question as the model wrote it, or undefined when it has none fit to ask. */
export function checkFirstQuestion(reply: string, lang: Lang): string | undefined {
  const object = firstObject(reply);
  if (!object) return undefined;
  try {
    const text = Reply.safeParse(JSON.parse(object)).data?.question.trim();
    if (!text || text.length > MAX_CHARS || questionProblem(text, []) || langOf(text) !== lang) return undefined;
    return text;
  } catch {
    return undefined;
  }
}

export async function modelFirstQuestion(
  model: Model,
  work: string,
  key: QuestionKey,
  lang: Lang,
  waitMs = MODEL_WAIT_MS,
): Promise<string | undefined> {
  try {
    const options = { maxTokens: MAX_TOKENS, temperature: 0, json: true, schema: SCHEMA };
    const reply = await within(
      model.generate(firstQuestionPrompt(work, key, lang), { ...options, purpose: Purpose.first_question }),
      waitMs,
    );
    return reply ? checkFirstQuestion(reply, lang) : undefined;
  } catch {
    return undefined;
  }
}

/** The model is to word the first question now: the work was picked by a tap, on a phone with a model. */
export const askingFirst = (s: Pick<NeedState, "slot" | "draft">): boolean =>
  s.slot === NeedSlot.detail && s.draft.tapped === true && s.draft.detailAsk === undefined && !!s.draft.modelAsk;

/** A need whose work was picked by a tap: the model words its first question. */
export const tappedNeed = (s: NeedState): NeedState => ({ ...s, draft: { ...s.draft, tapped: true } });

/** The model's words for the first question, or none: then the fixed question is asked. */
export function withFirstQuestion(s: NeedState, text: string | undefined): NeedState {
  if (!askingFirst(s)) return s;
  return { ...s, draft: { ...s.draft, detailAsk: text ?? "" } };
}
