import {
  NO_READER_WORK,
  READER_GUESSES_MAX,
  READER_SPANS_MAX,
  type ReaderGuess,
  ReaderResult,
  ReaderSlot,
  ReaderWork,
  type ReadSpan,
  TurnKind,
} from "@gigsync/protocol";

/**
 * The phone's reader's outputs as a reading (ADR 0065): which kind of message, which work, and each detail's words as
 * positions in the message. The decoding is `training/reader/reader/data.py`'s, kept in step with it, so the phone
 * reads a message as the export was checked to: a span runs from a `B-` token through the `I-` tokens of the same
 * detail, grows to the whole words it cuts into, and leaves out the punctuation stuck to its last word.
 */

/** What the model's outputs mean, in order: written next to the model as `labels.json` by its training. */
export interface ReaderLabels {
  turns: readonly string[];
  works: readonly string[];
  tags: readonly string[];
  /** The question's words when none is open. */
  no_question: string;
  max_tokens: number;
}

/** The model's probabilities for one message: one row per token of the message, in order. */
export interface ReaderOutputs {
  turn: ArrayLike<number>;
  work: ArrayLike<number>;
  tags: readonly ArrayLike<number>[];
}

/** How the tokenizer marks a token that starts a word (SentencePiece's metaspace). */
const WORD_START = "▁";
/** Punctuation left off a span's last word: "sector 2." is "sector 2". */
const TRAILING = ".,!?;:";
const OUTSIDE = "O";
const BEGIN = "B-";
const INSIDE = "I-";
const WORD_CHAR = /[\p{L}\p{N}]/u;
const SPACE = /\s/u;

type Offset = readonly [number, number];

const isWord = (c: string | undefined) => c !== undefined && WORD_CHAR.test(c);
const isSpace = (c: string | undefined) => c !== undefined && SPACE.test(c);

/**
 * Each token's characters in the message. The tokenizer gives none, so they are found by walking the message: a token
 * that starts a word skips the spaces before it, and a token the tokenizer normalized ("…" read as "...") takes the
 * characters up to its length or the next space. Spans grow to whole words after, so a token off by a character within
 * its word changes nothing.
 */
export function tokenOffsets(text: string, tokens: readonly string[]): Offset[] {
  const out: Offset[] = [];
  let at = 0;
  for (const token of tokens) {
    const startsWord = token.startsWith(WORD_START);
    const piece = startsWord ? token.slice(WORD_START.length) : token;
    if (startsWord) while (isSpace(text[at])) at += 1;
    if (text.startsWith(piece, at)) {
      out.push([at, at + piece.length]);
      at += piece.length;
      continue;
    }
    let end = at;
    while (end < text.length && !isSpace(text[end]) && end - at < piece.length) end += 1;
    out.push([at, end]);
    at = end;
  }
  return out;
}

/** The end of a token without the punctuation stuck to its word. */
function wordEnd(text: string, start: number, end: number): number {
  let cut = end;
  while (cut > start && TRAILING.includes(text[cut - 1] ?? "")) cut -= 1;
  return [...text.slice(start, cut)].some(isWord) ? cut : end;
}

/** A span grown to the words it cuts into: "cock" inside "cockroaches" is the whole word, as the labels always are. */
function wholeWords(text: string, from: number, to: number): Offset {
  let start = from;
  let end = to;
  while (start > 0 && isWord(text[start - 1]) && isWord(text[start])) start -= 1;
  while (end < text.length && isWord(text[end]) && isWord(text[end - 1])) end += 1;
  return [start, end];
}

function trimmed(text: string, [from, to]: Offset): Offset {
  let start = from;
  let end = to;
  while (start < end && isSpace(text[start])) start += 1;
  while (end > start && isSpace(text[end - 1])) end -= 1;
  return [start, end];
}

function argmax(row: ArrayLike<number>): { at: number; p: number } {
  let at = 0;
  for (let i = 1; i < row.length; i += 1) if ((row[i] ?? 0) > (row[at] ?? 0)) at = i;
  return { at, p: row[at] ?? 0 };
}

/** The likeliest kinds of work, likeliest first; a label protocol does not name is left out. */
export function guessesOf(row: ArrayLike<number>, works: readonly string[]): ReaderGuess[] {
  return Array.from(row, (confidence, at) => ({ work: ReaderWork.safeParse(works[at]).data, confidence }))
    .flatMap((g) => (g.work === undefined ? [] : [{ work: g.work, confidence: g.confidence }]))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, READER_GUESSES_MAX);
}

interface Open {
  slot: string;
  start: number;
  end: number;
  scores: number[];
}

/** Character spans from one message's token tags; a lone `I-` starts a span, as a `B-` would. */
export function spansFromTags(
  text: string,
  offsets: readonly Offset[],
  tags: readonly string[],
  scores: readonly number[],
): ReadSpan[] {
  const open: Open[] = [];
  let current: Open | undefined;
  offsets.forEach(([start, rawEnd], i) => {
    const tag = tags[i] ?? OUTSIDE;
    if (start === rawEnd) return;
    if (tag === OUTSIDE) {
      current = undefined;
      return;
    }
    const slot = tag.slice(BEGIN.length);
    const end = wordEnd(text, start, rawEnd);
    const score = scores[i] ?? 0;
    if (tag.startsWith(INSIDE) && current?.slot === slot) {
      current.end = end;
      current.scores.push(score);
      return;
    }
    current = { slot, start, end, scores: [score] };
    open.push(current);
  });
  return open.flatMap((s) => {
    const slot = ReaderSlot.safeParse(s.slot).data;
    const [start, end] = trimmed(text, wholeWords(text, s.start, s.end));
    return slot && end > start ? [{ slot, start, end, confidence: Math.min(...s.scores) }] : [];
  });
}

/**
 * One message's reading from the model's outputs and the message's tokens; undefined when it is not a reading (labels
 * that do not fit the outputs). A kind of work the labels name that protocol does not is read as none.
 */
export function readerResult(
  text: string,
  tokens: readonly string[],
  outputs: ReaderOutputs,
  labels: ReaderLabels,
): ReaderResult | undefined {
  const turn = argmax(outputs.turn);
  const work = argmax(outputs.work);
  const best = outputs.tags.map(argmax);
  const spans = spansFromTags(
    text,
    tokenOffsets(text, tokens),
    best.map((b) => labels.tags[b.at] ?? OUTSIDE),
    best.map((b) => b.p),
  );
  const parsed = ReaderResult.safeParse({
    turn: TurnKind.safeParse(labels.turns[turn.at]).data,
    turn_confidence: turn.p,
    work: ReaderWork.safeParse(labels.works[work.at]).data ?? NO_READER_WORK,
    work_confidence: work.p,
    guesses: guessesOf(outputs.work, labels.works),
    spans: spans.slice(0, READER_SPANS_MAX),
  });
  return parsed.success ? parsed.data : undefined;
}
