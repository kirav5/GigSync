import type { GenerateOptions, Model } from "../src/index.js";

/** What a fake model does when asked: answer with a text, fail, or never answer. */
export const Hang = Symbol("hang");

/** A model that answers every prompt the same way and keeps the prompts it was given. */
export class FakeModel implements Model {
  readonly prompts: string[] = [];
  readonly options: (GenerateOptions | undefined)[] = [];
  constructor(private readonly reply: string | null | Error | typeof Hang) {}
  generate(prompt: string, options?: GenerateOptions): Promise<string | null> {
    this.prompts.push(prompt);
    this.options.push(options);
    if (this.reply === Hang) return new Promise(() => {});
    if (this.reply instanceof Error) return Promise.reject(this.reply);
    return Promise.resolve(this.reply);
  }
}

/** A model reply proposing these questions, as the worker's agent's prompt asks for them. */
export const questionsReply = (...questions: { text: string; kind: string }[]) => JSON.stringify({ questions });
