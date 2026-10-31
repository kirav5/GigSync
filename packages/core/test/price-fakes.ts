import type { GenerateOptions, Model, NeedState } from "../src/index.js";
import { awaitingModel, modelPriceStep, priceContext, withPriceStep } from "../src/index.js";

/** A phone model that answers each prompt with the next reply in its script (the last one again once it runs out). */
export class ScriptModel implements Model {
  readonly prompts: string[] = [];
  constructor(private readonly replies: readonly string[]) {}
  generate(prompt: string, _options?: GenerateOptions): Promise<string | null> {
    this.prompts.push(prompt);
    return Promise.resolve(this.replies[Math.min(this.prompts.length - 1, this.replies.length - 1)] ?? null);
  }
}

/** One step of the price questions as the model writes it. */
export const step = (o: {
  done?: boolean;
  text?: string;
  fills?: string;
  choices?: string[];
  facts?: { label: string; value: string }[];
}) =>
  JSON.stringify({
    done: o.done ?? false,
    reason: "test",
    ...(o.text
      ? { question: { text: o.text, fills: o.fills ?? "", ...(o.choices ? { choices: o.choices } : {}) } }
      : {}),
    facts: o.facts ?? [],
  });

/** Asks the model while the interview waits on it, as the app does after each answer. */
export async function think(s: NeedState, model: Model): Promise<NeedState> {
  let at = s;
  while (awaitingModel(at.draft)) at = withPriceStep(at, await modelPriceStep(model, priceContext(at)));
  return at;
}
