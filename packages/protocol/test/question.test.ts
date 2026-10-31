import { describe, expect, it } from "vitest";
import { ASK_TEXT_MAX, Clarify, isModelQuestion, MAX_QUESTIONS, Question } from "../src/index.js";

const asked = { key: "ask_a", text: "Is the fan making a humming sound?", lang: "en", kind: "yes_no", by: "model" };

describe("questions on the wire", () => {
  it("a standard question is a key; any extra words are stripped", () => {
    expect(Question.parse({ key: "pets" })).toEqual({ key: "pets" });
    expect(Question.parse({ key: "pets", text: "Any pets?" })).toEqual({ key: "pets" });
    expect(isModelQuestion(Question.parse({ key: "pets" }))).toBe(false);
  });

  it("a model question keeps its words, language, kind and author", () => {
    const q = Question.parse(asked);
    expect(q).toEqual(asked);
    expect(isModelQuestion(q)).toBe(true);
  });

  it("a model question never uses a standard key, so its answer cannot feed the price rules", () => {
    expect(Question.parse({ ...asked, key: "pets" })).toEqual({ key: "pets" });
    expect(Clarify.safeParse({ questions: [{ ...asked, key: "favourite_colour" }] }).success).toBe(true);
  });

  it("refuses a model question with a bad kind, author, language or length", () => {
    expect(Question.safeParse({ ...asked, key: "ask_b", kind: "essay" }).success).toBe(false);
    expect(Question.safeParse({ ...asked, key: "ask_b", by: "worker" }).success).toBe(false);
    expect(Question.safeParse({ ...asked, key: "ask_b", lang: "fr" }).success).toBe(false);
    expect(Question.safeParse({ ...asked, key: "ask_b", text: `${"a".repeat(ASK_TEXT_MAX)}?` }).success).toBe(false);
    expect(Question.safeParse({ ...asked, key: "Ask B" }).success).toBe(false);
  });

  it("a clarify mixes both shapes, one question per key, at most the limit", () => {
    expect(Clarify.parse({ questions: [{ key: "rooms" }, asked] }).questions).toHaveLength(2);
    expect(Clarify.safeParse({ questions: [asked, asked] }).success).toBe(false);
    const many = Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => ({ ...asked, key: `ask_${"abcdefgh"[i]}` }));
    expect(Clarify.safeParse({ questions: many }).success).toBe(false);
  });
});
