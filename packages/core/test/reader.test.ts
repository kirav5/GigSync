import { readFileSync } from "node:fs";
import {
  Arrangement,
  NO_READER_WORK,
  type ReaderInput,
  type ReaderResult,
  type ReaderSlot,
  TurnKind,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  NeedSlot,
  READER_WORK_MIN,
  type ReaderLabels,
  readerAsking,
  readerReads,
  readerResult,
  readerTurn,
  readMessage,
  spansFromTags,
  tokenOffsets,
  turnFromReader,
} from "../src/index.js";

/**
 * The phone's reader's decoding (ADR 0065), against `training/reader`'s: messages from `eval:find` and a few written
 * for their punctuation, spaces and symbols, with the tokens and tags the trained reader gave them and the spans
 * Python decoded from those. The phone must find the same words, or the export's check would not hold on the phone.
 */
interface Case {
  text: string;
  tokens: string[];
  tags: string[];
  scores: number[];
  spans: { slot: ReaderSlot; start: number; end: number }[];
}
const cases: Case[] = JSON.parse(readFileSync(new URL("./fixtures/reader-decode.json", import.meta.url), "utf8"));

const LABELS: ReaderLabels = {
  turns: TurnKind.options,
  works: [NO_READER_WORK, "plumber", "tv_repair", "not_a_kind_anymore"],
  tags: [
    "O",
    "B-kind",
    "I-kind",
    "B-where",
    "I-where",
    "B-when",
    "I-when",
    "B-what",
    "I-what",
    "B-how_long",
    "I-how_long",
  ],
  no_question: "none",
  max_tokens: 96,
};

const W = TurnKind.enum;
const SURE = 0.9;
const UNSURE = READER_WORK_MIN - 0.1;

const result = (r: Partial<ReaderResult>): ReaderResult => ({
  turn: W.need,
  turn_confidence: SURE,
  work: NO_READER_WORK,
  work_confidence: SURE,
  spans: [],
  ...r,
});

/** A span over the words of `text` it names. */
const span = (text: string, words: string, slot: ReaderSlot) => {
  const start = text.indexOf(words);
  return { slot, start, end: start + words.length, confidence: SURE };
};

describe("the reader's decoding", () => {
  it.each(cases.map((c) => [c.text, c] as const))("finds Python's spans in %j", (_, c) => {
    // Python counts characters and JavaScript UTF-16 units ("😢" is two), so the words are compared, not positions.
    const got = spansFromTags(c.text, tokenOffsets(c.text, c.tokens), c.tags, c.scores);
    const chars = [...c.text];
    const want = c.spans.map((s) => ({ slot: s.slot, words: chars.slice(s.start, s.end).join("") }));
    expect(got.map((s) => ({ slot: s.slot, words: c.text.slice(s.start, s.end) }))).toEqual(want);
  });

  it("walks tokens through spaces, apostrophes and characters the tokenizer changed", () => {
    expect(tokenOffsets("AC  not", ["▁AC", "▁not"])).toEqual([
      [0, 2],
      [4, 7],
    ]);
    expect(tokenOffsets("geyser's…", ["▁geyser", "'", "s", "..."])).toEqual([
      [0, 6],
      [6, 7],
      [7, 8],
      [8, 9],
    ]);
  });

  it("reads the outputs into a checked result, a kind protocol no longer has read as none", () => {
    const text = "need a plumber";
    const tokens = ["▁need", "▁a", "▁plumber"];
    const tagRow = (at: number) => LABELS.tags.map((_, i) => (i === at ? 1 : 0));
    const outputs = { turn: [0, 0.9, 0.1, 0, 0], work: [0.1, 0.8, 0.1, 0], tags: [tagRow(0), tagRow(0), tagRow(1)] };
    expect(readerResult(text, tokens, outputs, LABELS)).toMatchObject({
      turn: W.need,
      work: "plumber",
      spans: [{ slot: "kind", start: 7, end: 14 }],
    });
    const gone = { ...outputs, work: [0, 0, 0, 1] };
    expect(readerResult(text, tokens, gone, LABELS)?.work).toBe(NO_READER_WORK);
  });
});

describe("the reader's reading as Find's", () => {
  it("takes the work it is sure of: a trade or a kind of work", () => {
    expect(turnFromReader(result({ work: "plumber" }), "tap leaking")).toEqual({ kind: W.need, trade: "plumber" });
    expect(turnFromReader(result({ work: "tv_repair" }), "my tv")).toEqual({ kind: W.need, category: "tv_repair" });
  });

  it("leaves work it is unsure of to the matchers", () => {
    expect(turnFromReader(result({ work: "tailor", work_confidence: UNSURE }), "blouse")).toEqual({ kind: W.need });
  });

  it("names work on no list in the owner's words only when sure the message names none it knows", () => {
    const text = "need a kite maker";
    const kind = [span(text, "kite maker", "kind")];
    expect(turnFromReader(result({ spans: kind }), text).jobType).toBe("kite maker");
    expect(turnFromReader(result({ spans: kind, work_confidence: UNSURE }), text).jobType).toBeUndefined();
  });

  it("reads how the work is hired from the how_long words alone, so a date is never an arrangement", () => {
    const text = "need a cook every day from next month";
    const read = turnFromReader(result({ work: "cook", spans: [span(text, "every day", "how_long")] }), text);
    expect(read.arrangement).toBe(Arrangement.enum.monthly);
    const dated = turnFromReader(result({ work: "cook", spans: [span(text, "next month", "when")] }), text);
    expect(dated.arrangement).toBeUndefined();
  });

  it("says the message says what is wanted when it marks what", () => {
    const text = "my tv is not working";
    expect(turnFromReader(result({ spans: [span(text, text, "what")] }), text).problem).toBe(true);
  });

  it("tells the reader the detail the open question asks for", () => {
    expect(readerAsking(NeedSlot.area)).toBe("where");
    expect(readerAsking(NeedSlot.arrangement)).toBe("how_long");
    expect(readerAsking(NeedSlot.budget)).toBeUndefined();
    expect(readerAsking(NeedSlot.detail)).toBeUndefined();
  });
});

describe("the reader at an open question", () => {
  /** A reader that answers the question it is told of, and reads the words plainly as a need for a TV. */
  const reader = (marks: boolean) => ({
    asked: [] as ReaderInput[],
    async read(input: ReaderInput) {
      this.asked.push(input);
      if (!input.asking) return result({ work: "tv_repair" });
      const spans = marks ? [{ slot: input.asking, start: 0, end: 5, confidence: SURE }] : [];
      return result({ turn: W.answer, spans });
    },
  });

  it("takes an answer that marks the detail asked for", async () => {
    const r = reader(true);
    expect(await readerTurn(r, "HSR Layout", NeedSlot.area)).toEqual({ kind: W.answer });
    expect(r.asked).toHaveLength(1);
  });

  it("reads words that answer nothing again with no question, so other work is seen", async () => {
    const r = reader(false);
    expect(await readerTurn(r, "my tv is not working", NeedSlot.area)).toEqual({ kind: W.need, category: "tv_repair" });
    expect(r.asked).toEqual([{ text: "my tv is not working", asking: "where" }, { text: "my tv is not working" }]);
  });

  it("reads nothing when the reader does not", async () => {
    expect(await readerTurn({ read: async () => null }, "मेरा नल टपक रहा है")).toBeUndefined();
  });
});

describe("what the reader reads", () => {
  it("reads English, borrowed words and all", () => {
    expect(readerReads("I need a plumber in Koramangala tomorrow")).toBe(true);
    expect(readerReads("cleaning of the side windows")).toBe(true);
  });

  it("reads Hinglish, which it is trained on", () => {
    expect(readerReads("mera cooler kharab ho gaya")).toBe(true);
    expect(readerReads("bas ek")).toBe(true);
    expect(readerReads("almari mein deemak lag gayi hai")).toBe(true);
  });

  it("leaves Hindi and Kannada to the readers below it, in their scripts, and Kanglish", () => {
    expect(readerReads("मेरा नल टपक रहा है")).toBe(false);
    expect(readerReads("ನನ್ನ ಟಿವಿ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ")).toBe(false);
    expect(readerReads("ac service madisbeku")).toBe(false);
    expect(readerReads("nanna mane alli fan kelsa madtilla")).toBe(false);
  });
});

describe("Find's reading of a message", () => {
  const tv = { read: async () => result({ work: "tv_repair" }) };
  const fromModel = { kind: W.need, trade: "electrician" } as const;
  const model = (answers: boolean) => async () => (answers ? fromModel : undefined);

  it("reads English with the reader alone, never asking the model", async () => {
    let asked = false;
    const read = await readMessage(tv, "my tv is broken", undefined, async () => {
      asked = true;
      return fromModel;
    });
    expect(read?.category).toBe("tv_repair");
    expect(asked).toBe(false);
  });

  it("reads Hinglish with the reader alone, never asking the model", async () => {
    let asked = false;
    const read = await readMessage(tv, "mera tv kharab hai", undefined, async () => {
      asked = true;
      return fromModel;
    });
    expect(read?.category).toBe("tv_repair");
    expect(asked).toBe(false);
  });

  it("asks the model for Kanglish, and the reader only when the model has no answer", async () => {
    expect(await readMessage(tv, "nanna tv kelsa madtilla beku", undefined, model(true))).toBe(fromModel);
    expect((await readMessage(tv, "nanna tv kelsa madtilla beku", undefined, model(false)))?.category).toBe(
      "tv_repair",
    );
  });

  it("never gives Hindi or Kannada in their scripts to the reader", async () => {
    expect(await readMessage(tv, "मेरा टीवी खराब है", undefined, model(false))).toBeUndefined();
  });
});
