import type { BoardSkill, WorkCategory } from "@gigsync/protocol";
import { z } from "zod";
import { t } from "../i18n/t.js";
import { firstObject, MODEL_WAIT_MS, within } from "../interview/need-model.js";
import type { Model } from "../ports.js";

/**
 * A kind of work nobody has filed under yet may still be listed in a worker's own words: "TV repair" has no worker,
 * but one lists "TV mechanic" and never said what kind of work it is. Before Find says nobody offers the work, one
 * call asks which of those unfiled names, if any, is that kind of work (ADR 0059). The answer is a name held to the
 * list, never a made-up one.
 */

const MAX_TOKENS = 30;
/** Unfiled skills offered, most-listed first, as the reader's list has them. */
const MAX_OWN_SKILLS = 30;
const NEW_LINE = "\n";
const ENGLISH = "en";
const Reply = z.object({ work: z.string().nullable() });

export function sameWorkPrompt(kind: string, names: readonly string[]): string {
  return [
    `Which of these names that workers gave their own work is exactly the same work as "${kind}"? Reply with one JSON object only.`,
    'Reply {"work": "<the name exactly as written>"}, or {"work": null} when none of them is that work.',
    `Only a name for this very work counts: someone asking for "${kind}" must be glad to get that worker. Other work of the same sort, or with a word in common, does not: use null.`,
    ...names.map((name) => `- ${name}`),
  ].join(NEW_LINE);
}

/** The unfiled listed skill that is this kind of work; undefined with none, no model, or no answer. */
export async function sameWork(
  model: Model,
  category: WorkCategory,
  listed: readonly BoardSkill[],
  waitMs = MODEL_WAIT_MS,
): Promise<BoardSkill | undefined> {
  const own = listed.filter((s) => !s.category).slice(0, MAX_OWN_SKILLS);
  if (own.length === 0) return undefined;
  const names = own.map((s) => s.text);
  const schema = {
    type: "object",
    properties: { work: { type: ["string", "null"], enum: [...names, null] } },
    required: ["work"],
  };
  try {
    const prompt = sameWorkPrompt(t(ENGLISH, `category.${category}`), names);
    const reply = await within(
      model.generate(prompt, { maxTokens: MAX_TOKENS, temperature: 0, json: true, schema }),
      waitMs,
    );
    const object = reply ? firstObject(reply) : undefined;
    const work = object ? Reply.safeParse(JSON.parse(object)).data?.work : undefined;
    return work ? own.find((s) => s.text === work) : undefined;
  } catch {
    return undefined;
  }
}
