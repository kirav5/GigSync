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

/** The model's reply: its questions, each with a label and any choices. */
export const questions = (...list: { text: string; label: string; choices?: string[] }[]) =>
  JSON.stringify({ questions: list });

/** Asks the model while the interview waits on it, as the app does. */
export async function think(s: NeedState, model: Model): Promise<NeedState> {
  let at = s;
  while (awaitingModel(at.draft)) at = withPriceStep(at, await modelPriceStep(model, priceContext(at)));
  return at;
}
