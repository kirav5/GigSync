import type { CityGuide, GuideSection } from "@gigsync/protocol";
import { z } from "zod";
import { firstObject, MODEL_WAIT_MS, within } from "../interview/need-model.js";
import type { Model } from "../ports.js";

/**
 * A model's one job in "Ask the guide": choose which section answers a question, by id, from the guide's titles. Its
 * reply counts only when it is a JSON object whose `id` is one of the guide's section ids; anything else (prose, an id
 * it made up, words meant to steer the app, or no answer in time) means no section. Its words are never shown.
 */

/** An id and nothing else: anything longer is not the object asked for. */
const MAX_TOKENS = 40;
const ID_MAX = 80;
const Reply = z.object({ id: z.string().max(ID_MAX).nullable() });

export function pickPrompt(guide: CityGuide, question: string): string {
  const titles = guide.sections.map((s) => `${JSON.stringify(s.id)}: ${s.title}`);
  return [
    "Which section of a city guide answers this question? Reply with one JSON object and nothing else:",
    '{"id": one of the ids below | null}. Reply null when none answers it.',
    ...titles,
    `Question: ${JSON.stringify(question)}`,
  ].join("\n");
}

function idOf(reply: string): string | undefined {
  const object = firstObject(reply);
  if (!object) return undefined;
  try {
    return Reply.safeParse(JSON.parse(object)).data?.id ?? undefined;
  } catch {
    return undefined;
  }
}

/** The section a model chose for the question, checked against the guide; undefined on anything else or after `waitMs`. */
export async function pickSection(
  model: Model,
  guide: CityGuide,
  question: string,
  waitMs = MODEL_WAIT_MS,
): Promise<GuideSection | undefined> {
  try {
    const reply = await within(model.generate(pickPrompt(guide, question), { maxTokens: MAX_TOKENS }), waitMs);
    const id = reply ? idOf(reply) : undefined;
    return id === undefined ? undefined : guide.sections.find((s) => s.id === id);
  } catch {
    return undefined;
  }
}
