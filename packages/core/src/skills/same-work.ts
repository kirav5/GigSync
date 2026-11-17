import type { BoardSkill, WorkCategory } from "@gigsync/protocol";
import { ModelPurpose } from "@gigsync/protocol";
import { z } from "zod";
import { t } from "../i18n/t.js";
import { firstObject, MODEL_WAIT_MS, within } from "../interview/need-model.js";
import type { Model } from "../ports.js";
import { CATEGORY_SCOPE } from "./work-scope.js";

const Purpose = ModelPurpose.enum;

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
/**
 * The answer when no name is this work, offered as one more line of the list: a small model held to a list picks a
 * line, and with only null outside it, it picked the nearest name ("geyser repair" for water tank cleaning).
 */
export const NONE_OF_THEM = "none of these";
const Reply = z.object({ work: z.string() });

export function sameWorkPrompt(kind: string, names: readonly string[], scope?: string): string {
  const work = scope ? `"${kind}" (${scope})` : `"${kind}"`;
  return [
    `Which of these names that workers gave their own work is exactly the same work as ${work}? Reply with one JSON object only.`,
    `Reply {"work": "<the line exactly as written>"}, or {"work": "${NONE_OF_THEM}"} when no name is this work.`,
    `A name in other words for this very work counts ("darzi" is a tailor's work): someone asking for "${kind}" must be glad to get that worker. Other work, even of the same sort or with a word in common, does not: "${NONE_OF_THEM}".`,
    `- ${NONE_OF_THEM}`,
    ...names.map((name) => `- ${name}`),
  ].join(NEW_LINE);
}

/** The yes or no to one name: asked of the name the list call picked, which a small model picks even when it is wrong. */
export function sameWorkCheck(kind: string, name: string, scope?: string): string {
  const work = scope ? `"${kind}" (${scope})` : `"${kind}"`;
  return [
    `A worker calls their work "${name}". Is that ${work}, said in other words? Reply with one JSON object only.`,
    `Reply {"same": true} when someone asking for "${kind}" would be glad to get this worker, or {"same": false} when it is other work.`,
  ].join(NEW_LINE);
}

const Same = z.object({ same: z.boolean() });
const SAME_SCHEMA = { type: "object", properties: { same: { type: "boolean" } }, required: ["same"] } as const;

/** One call for a JSON reply, parsed; undefined on anything else. */
async function ask<T>(
  model: Model,
  prompt: string,
  schema: Readonly<Record<string, unknown>>,
  parse: z.ZodType<T>,
  waitMs: number,
) {
  const options = { maxTokens: MAX_TOKENS, temperature: 0, json: true, schema, purpose: Purpose.same_work };
  const reply = await within(model.generate(prompt, options), waitMs);
  const object = reply ? firstObject(reply) : undefined;
  return object ? parse.safeParse(JSON.parse(object)).data : undefined;
}

/**
 * The unfiled listed skill that is this kind of work; undefined with none, no model, or no answer. The name the list
 * call picks is checked on its own before it stands: in the run of all kinds the list call alone put a geyser
 * repairer in place of a gas stove repairer.
 */
export async function sameWork(
  model: Model,
  category: WorkCategory,
  listed: readonly BoardSkill[],
  waitMs = MODEL_WAIT_MS,
): Promise<BoardSkill | undefined> {
  const own = listed.filter((s) => !s.category).slice(0, MAX_OWN_SKILLS);
  if (own.length === 0) return undefined;
  const names = own.map((s) => s.text);
  const kind = t(ENGLISH, `category.${category}`);
  const scope = CATEGORY_SCOPE[category];
  const schema = {
    type: "object",
    properties: { work: { type: "string", enum: [NONE_OF_THEM, ...names] } },
    required: ["work"],
  };
  try {
    const picked = (await ask(model, sameWorkPrompt(kind, names, scope), schema, Reply, waitMs))?.work;
    const skill = picked ? own.find((s) => s.text === picked) : undefined;
    if (!skill) return undefined;
    const checked = await ask(model, sameWorkCheck(kind, skill.text, scope), SAME_SCHEMA, Same, waitMs);
    return checked?.same ? skill : undefined;
  } catch {
    return undefined;
  }
}
