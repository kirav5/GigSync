import { describe, expect, it } from "vitest";
import { READER_SPANS_MAX, READER_TEXT_MAX, ReaderExample, ReaderInput, ReaderResult } from "../src/index.js";

// "need maid in HSR from monday" → kind 5..9, where 13..16, when 17..28
const TEXT = "need maid in HSR from monday";
const KIND = { slot: "kind", start: 5, end: 9 } as const;
const WHERE = { slot: "where", start: 13, end: 16 } as const;
const WHEN = { slot: "when", start: 17, end: 28 } as const;
const example = (spans: readonly object[], text = TEXT) => ({ text, turn: "need", spans });

describe("the reader's labelled messages", () => {
  it("takes a message with its details marked, in any order", () => {
    const parsed = ReaderExample.parse(example([WHEN, KIND, WHERE]));
    expect(parsed.spans.map((s) => TEXT.slice(s.start, s.end))).toEqual(["from monday", "maid", "HSR"]);
    expect(ReaderExample.safeParse({ ...example([]), turn: "greeting", asking: "when" }).success).toBe(true);
  });

  it("refuses a span past the message, overlapping another, or ending before it starts", () => {
    expect(ReaderExample.safeParse(example([{ ...WHEN, end: TEXT.length + 1 }])).success).toBe(false);
    expect(ReaderExample.safeParse(example([KIND, { ...WHERE, start: 8 }])).success).toBe(false);
    expect(ReaderExample.safeParse(example([{ ...KIND, end: KIND.start }])).success).toBe(false);
  });

  it("refuses a detail or kind of message outside the lists", () => {
    expect(ReaderExample.safeParse(example([{ ...KIND, slot: "budget" }])).success).toBe(false);
    expect(ReaderExample.safeParse({ ...example([]), turn: "question" }).success).toBe(false);
    expect(ReaderInput.safeParse({ text: TEXT, asking: "price" }).success).toBe(false);
  });

  it("refuses an empty or too long message, and too many spans", () => {
    expect(ReaderInput.safeParse({ text: "" }).success).toBe(false);
    expect(ReaderInput.safeParse({ text: "a".repeat(READER_TEXT_MAX + 1) }).success).toBe(false);
    const many = Array.from({ length: READER_SPANS_MAX + 1 }, (_, i) => ({ slot: "what", start: i, end: i + 1 }));
    expect(ReaderExample.safeParse(example(many, "x".repeat(READER_SPANS_MAX + 1))).success).toBe(false);
  });
});

describe("the reader's answer", () => {
  it("says how sure it is of the kind of message and of each span, from 0 to 1", () => {
    const answer = { turn: "need", turn_confidence: 0.97, spans: [{ ...KIND, confidence: 0.9 }] };
    expect(ReaderResult.safeParse(answer).success).toBe(true);
    expect(ReaderResult.safeParse({ ...answer, turn_confidence: 1.2 }).success).toBe(false);
    expect(ReaderResult.safeParse({ ...answer, spans: [{ ...KIND, confidence: -0.1 }] }).success).toBe(false);
    expect(ReaderResult.safeParse({ ...answer, spans: [KIND] }).success).toBe(false);
  });
});
