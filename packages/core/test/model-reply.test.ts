import { newDeviceSecrets } from "@gigsync/crypto";
import { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { Agent, ChatRole, MemoryStorage, plainReply, SecretKeys, withoutReasoning } from "../src/index.js";
import { FakeModel } from "./model-fakes.js";

/** What Qwen3.5-2B gave the Talk screen for "hey" through WebLLM, empty thinking block and all. */
const WEBLLM_HEY = "<think>\n\n</think>\n\nHey there! How can I help you?";
const MARKDOWN = [
  "<think>The user asks about a nanny.</think>",
  "## Kinds of work",
  "* **Cook**: makes *fresh* meals",
  "- __Maid__: cleans, see [the list](https://example.com/list)",
  "",
  "",
  "",
  "Use `Find` to ask.",
].join("\n");

describe("a model's reasoning never reaches the owner", () => {
  it("takes off an empty thinking block, as WebLLM sends with thinking turned off", () => {
    expect(withoutReasoning(WEBLLM_HEY)).toBe("Hey there! How can I help you?");
    expect(withoutReasoning("<think></think> Hey there!")).toBe("Hey there!");
  });

  it("takes off a block over many lines, and every block when there are several", () => {
    const reply = "<think>\nThe user greets me.\nI should greet back.\n</think>\nHello!<think>again</think> Bye.";
    expect(withoutReasoning(reply)).toBe("Hello!Bye.");
  });

  it("drops a block the token limit cut off, and the words before a closing tag whose opening was in the prompt", () => {
    expect(withoutReasoning("<think>\nLet me think about street cleaning and")).toBe("");
    expect(withoutReasoning("Hi <think>half a thought")).toBe("Hi");
    expect(withoutReasoning("The user said hey, so greet.\n</think>\n\nHey!")).toBe("Hey!");
  });

  it("matches the tags in any case, and leaves a reply without them alone", () => {
    expect(withoutReasoning("<THINK>x</Think>Ok")).toBe("Ok");
    expect(withoutReasoning("  Ravi pays ₹500 on Fridays. ")).toBe("Ravi pays ₹500 on Fridays.");
  });
});

describe("a model's reply reads as plain text", () => {
  it("takes Markdown's marks off the words, keeping a bullet for each list line", () => {
    expect(plainReply(MARKDOWN)).toBe(
      ["Kinds of work", "• Cook: makes fresh meals", "• Maid: cleans, see the list", "", "Use Find to ask."].join("\n"),
    );
  });

  it("leaves a star between numbers, and plain words, as they are", () => {
    expect(plainReply("2 * 3 rooms at ₹1,500")).toBe("2 * 3 rooms at ₹1,500");
    expect(plainReply("नमस्ते! मैं आपकी कैसे मदद करूँ?")).toBe("नमस्ते! मैं आपकी कैसे मदद करूँ?");
  });
});

describe("the agent's chat reply", () => {
  const agentWith = (model: FakeModel) =>
    new Agent({
      storage: new MemoryStorage(),
      keys: new SecretKeys(newDeviceSecrets()),
      model,
      clock: { now: () => new Date() },
    });
  const WORKER = { lang: Lang.enum.en, role: ChatRole.worker };

  it("shows the words without reasoning or Markdown, asked with GigSync's own context", async () => {
    const model = new FakeModel("<think></think> **Hey** there! How can I help you?");
    const agent = agentWith(model);
    const route = await agent.route("hey", WORKER);
    const card = await agent.answer("hey", route);
    expect(card).toMatchObject({ kind: "text", words: { text: "Hey there! How can I help you?" } });
    const prompt = model.prompts.at(-1) ?? "";
    expect(prompt).toContain("GigSync");
    expect(prompt).toContain("plain text");
    expect(prompt).toContain('Message: "hey"');
  });

  it("says it needs a model when the reply was only reasoning", async () => {
    const agent = agentWith(new FakeModel("<think>\nstreet cleaning is"));
    const card = await agent.answer("what does a nanny do?", await agent.route("what does a nanny do?", WORKER));
    expect(card.kind).toBe("needs_model");
  });
});
