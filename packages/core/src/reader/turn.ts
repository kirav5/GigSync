import {
  Arrangement,
  NO_READER_WORK,
  type ReaderResult,
  ReaderSlot,
  Trade,
  TurnKind,
  WorkCategory,
} from "@gigsync/protocol";
import { arrangementSaid } from "../interview/arrangement-words.js";
import { scrubJobType } from "../interview/fact-scrub.js";
import { NeedSlot } from "../interview/need.js";
import type { TurnRead } from "../interview/read-turn.js";
import type { Reader } from "../ports.js";
import { inEnglishLetters, readerReads } from "./languages.js";

/**
 * The phone's reader's answer as Find's reading of a message (ADR 0065 §7), in the shape GigSync's model's reading
 * takes (`read-turn.ts`), so the interview decides from it as it does from the model's. The work is the reader's own
 * when it is sure; below that the message's words go to the matchers that read it with no model (by meaning, then the
 * listed skills). How the work is hired comes from the words marked `how_long` only, so "next month" is never monthly.
 */

/** How sure the reader must be of the kind of work for Find to take it: below this, its guess is wrong as often. */
export const READER_WORK_MIN = 0.5;

const Slot = ReaderSlot.enum;

/**
 * Daily work is hired by the month, as GigSync's model was told ("a cook daily"): read so only in the words the reader
 * marked `how_long`, where "every day" says how the work is hired and not when one visit is.
 */
const DAILY = /\b(?:daily|every ?day)\b|रोज़|रोज|ಪ್ರತಿದಿನ|ದಿನಾಲೂ/i;

const hiredBy = (words: string): Arrangement | undefined =>
  arrangementSaid(words) ?? (DAILY.test(words) ? Arrangement.enum.monthly : undefined);

/**
 * The detail the open question asks for, as the reader is told it. Questions with no detail of their own have none:
 * a job's details ("How many AC units?") are not what is wrong, and told `what` the reader takes "my TV is not working
 * either" for an answer, where the chat should offer to switch.
 */
const ASKING: Readonly<Partial<Record<NeedSlot, ReaderSlot>>> = {
  [NeedSlot.trade]: Slot.kind,
  [NeedSlot.scope]: Slot.what,
  [NeedSlot.area]: Slot.where,
  [NeedSlot.when]: Slot.when,
  [NeedSlot.arrangement]: Slot.how_long,
};

export const readerAsking = (slot: NeedSlot | undefined): ReaderSlot | undefined =>
  slot === undefined ? undefined : ASKING[slot];

/** The words of the first span of a detail, if the reader marked one. */
export function spanWords(result: ReaderResult, text: string, slot: ReaderSlot): string | undefined {
  const span = result.spans.find((s) => s.slot === slot);
  return span ? text.slice(span.start, span.end) : undefined;
}

/** The work the reader is sure of: a trade, a kind of work, or sure the message names none. */
function sureWork(result: ReaderResult): Pick<TurnRead, "trade" | "category"> | typeof NO_READER_WORK | undefined {
  if (result.work_confidence < READER_WORK_MIN) return undefined;
  if (result.work === NO_READER_WORK) return NO_READER_WORK;
  const trade = Trade.safeParse(result.work).data;
  if (trade) return { trade };
  const category = WorkCategory.safeParse(result.work).data;
  return category ? { category } : undefined;
}

export function turnFromReader(result: ReaderResult, text: string): TurnRead {
  const work = sureWork(result);
  const kindWords = spanWords(result, text, Slot.kind);
  // Work on no list, in the owner's own words: only when the reader is sure the message names none it knows.
  const jobType =
    result.turn === TurnKind.enum.need && work === NO_READER_WORK && kindWords ? scrubJobType(kindWords) : undefined;
  const hired = spanWords(result, text, Slot.how_long);
  const arrangement = hired ? hiredBy(hired) : undefined;
  return {
    kind: result.turn,
    ...(work && work !== NO_READER_WORK ? work : {}),
    ...(jobType ? { jobType } : {}),
    ...(spanWords(result, text, Slot.what) ? { problem: true as const } : {}),
    ...(arrangement ? { arrangement } : {}),
  };
}

/**
 * One message in Find read by the phone's reader, at the question open if any; undefined when the reader does not read
 * it. Told a question, the reader takes nearly any words for its answer; an answer that marks nothing of the detail
 * asked for is none, so the words are read again as if no question were open: "my TV is not working" at "Where?" is
 * other work, which the chat offers to switch to.
 */
export async function readerTurn(reader: Reader, text: string, slot?: NeedSlot): Promise<TurnRead | undefined> {
  const asking = readerAsking(slot);
  const read = await reader.read({ text, ...(asking ? { asking } : {}) });
  if (!read) return undefined;
  const answers = !asking || read.spans.some((s) => s.slot === asking);
  const plain = answers ? read : await reader.read({ text });
  return plain ? turnFromReader(plain, text) : undefined;
}

/**
 * Find's reading of one message (ADR 0065 §7, amended 2026-11-14): the reader alone for English and Hinglish, and
 * GigSync's model not asked; the model for the rest; and the reader again for Kanglish the model did not answer.
 */
export async function readMessage(
  reader: Reader | undefined,
  text: string,
  slot: NeedSlot | undefined,
  byModel: () => Promise<TurnRead | undefined>,
): Promise<TurnRead | undefined> {
  const first = reader && readerReads(text) ? await readerTurn(reader, text, slot) : undefined;
  if (first) return first;
  const model = await byModel();
  if (model || !reader || readerReads(text) || !inEnglishLetters(text)) return model;
  return readerTurn(reader, text, slot);
}
