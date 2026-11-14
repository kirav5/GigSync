import { z } from "zod";
import { Trade } from "./trade.js";
import { WorkCategory } from "./work-category.js";

/**
 * The phone's reader (ADR 0065): one message, and the question open, read into the kind of message and the spans of
 * it that say each detail of a need. It marks positions in the owner's words and never writes words of its own, so code
 * reads every span's meaning (areas, times, arrangements, kinds of work) as it reads the owner's words now. The same
 * shapes carry the training data, the test set and the reader's answers on the phone.
 */

/** The longest message the reader takes, in characters: a chat message, not a letter. */
export const READER_TEXT_MAX = 1000;
/** More spans than this in one message is not a reading: one or two of each detail at most. */
export const READER_SPANS_MAX = 12;

/** What a message in Find is (ADR 0056), as GigSync's model and the phone's reader both name it. */
export const TurnKind = z.enum(["greeting", "need", "answer", "market", "other"]);
export type TurnKind = z.infer<typeof TurnKind>;

/**
 * The details of a need the reader marks, and the question sets ask for while one is missing: the kind of work in the
 * owner's words, where, when, what (the scope, or what is wrong) and for how long (how the work is hired).
 */
export const ReaderSlot = z.enum(["kind", "where", "when", "what", "how_long"]);
export type ReaderSlot = z.infer<typeof ReaderSlot>;

/** How sure the reader is, from 0 to 1. */
const Confidence = z.number().min(0).max(1);

/** One detail's words: characters `start` up to, not including, `end` of the message. */
const SpanFields = z.object({
  slot: ReaderSlot,
  start: z.number().int().nonnegative(),
  end: z.number().int().positive().max(READER_TEXT_MAX),
});
type SpanFields = z.infer<typeof SpanFields>;

const inOrder = (s: SpanFields) => s.end > s.start;
const IN_ORDER = { message: "a span ends after it starts" };

export const ReaderSpan = SpanFields.refine(inOrder, IN_ORDER);
export type ReaderSpan = z.infer<typeof ReaderSpan>;

/** A span as the reader gives it, with how sure it is of it. */
export const ReadSpan = SpanFields.extend({ confidence: Confidence }).refine(inOrder, IN_ORDER);
export type ReadSpan = z.infer<typeof ReadSpan>;

/** What the reader is given: the message, and the detail the open question asks for ("mornings" answers `when`). */
export const ReaderInput = z.object({
  text: z.string().min(1).max(READER_TEXT_MAX),
  asking: ReaderSlot.optional(),
});
export type ReaderInput = z.infer<typeof ReaderInput>;

/** Spans that lie inside the message and do not overlap: one word is one detail at most. */
function spansFit(text: string, spans: readonly SpanFields[]): boolean {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  return sorted.every((s, i) => s.end <= text.length && (i === 0 || (sorted[i - 1]?.end ?? 0) <= s.start));
}
const SPANS_FIT = { message: "spans lie inside the message and do not overlap", path: ["spans"] };

/** One training or test message, labelled: what it is and where each detail it says stands. */
export const ReaderExample = ReaderInput.extend({
  turn: TurnKind,
  spans: z.array(ReaderSpan).max(READER_SPANS_MAX),
}).refine((e) => spansFit(e.text, e.spans), SPANS_FIT);
export type ReaderExample = z.infer<typeof ReaderExample>;

/** The reader's word for a message that names no kind of work. */
export const NO_READER_WORK = "none";

/**
 * The kind of work a message is about, as the reader names it: a trade, a kind of work (ADR 0059), or none. Learned,
 * so "my TV won't turn on" is TV repair, not the electrician its nearest saying would be; a kind added to GigSync needs
 * a retrain before the reader names it.
 */
export const ReaderWork = z.union([Trade, WorkCategory, z.literal(NO_READER_WORK)]);
export type ReaderWork = z.infer<typeof ReaderWork>;

/** How many of its likeliest kinds of work the reader gives besides its first. */
export const READER_GUESSES_MAX = 3;

/** One kind of work the message may be about, and how likely the reader thinks it. */
export const ReaderGuess = z.object({ work: ReaderWork, confidence: Confidence });
export type ReaderGuess = z.infer<typeof ReaderGuess>;

/**
 * The reader's answer for one message; code checks the spans against the message it was given. `guesses` are its
 * likeliest kinds of work, likeliest first, so a message it is unsure of can be asked about instead of dropped.
 */
export const ReaderResult = z.object({
  turn: TurnKind,
  turn_confidence: Confidence,
  work: ReaderWork,
  work_confidence: Confidence,
  guesses: z.array(ReaderGuess).max(READER_GUESSES_MAX).optional(),
  spans: z.array(ReadSpan).max(READER_SPANS_MAX),
});
export type ReaderResult = z.infer<typeof ReaderResult>;
