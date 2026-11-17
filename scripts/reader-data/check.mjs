// Keeping only messages read the same way twice (ADR 0065 §5). The target's words must stand in the message as given and
// be marked as their detail; the writer's marks of its own message and the labeller's, made without the target, must
// name the same details over the same words. Details the target did not ask for are kept when both readings agree. Every value is a position in the message, so the example holds no words of its own.
import { protocol } from "./core.mjs";
import { ALL_KIND_WORDS } from "./languages.mjs";
import { isProblem } from "./sample.mjs";

/** Why a message was not kept; counted in the run's manifest. */
export const Dropped = {
  /** The teacher wrote no usable message, or marked words its message does not have. */
  unwritten: "unwritten",
  /** A detail's words are not in the message as given. */
  missing_words: "missing_words",
  /** The target asked for what the job is, and the labeller marked no words for it. */
  no_what: "no_what",
  /** The teacher's labels gave no usable reading. */
  unlabelled: "unlabelled",
  /** The labels name a different kind of message. */
  turn: "turn",
  /** The two readings mark different details, or the labeller misses one the target asked for. */
  slots: "slots",
  /** The two readings mark a detail over different words, or the target's words as another detail. */
  words: "words",
  /** The spans overlap, or the example fails the protocol's schema. */
  invalid: "invalid",
  /** A message that was to say only what is wrong names a kind of work after all. */
  named_work: "named_work",
};

/** Every kind's words in every language, as whole words, for telling whether a message names a kind of work. */
const WORK_WORDS = ALL_KIND_WORDS.map(
  (w) => new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu"),
);
export const namesWork = (message) => WORK_WORDS.some((w) => w.test(message));

/** A greeting or a message about anything but hiring says no detail of a need, whatever words it has. */
const WITHOUT_DETAILS = new Set([protocol.TurnKind.enum.greeting, protocol.TurnKind.enum.other]);

/** Where `words` stand in `text`, ignoring case; undefined when they are not there. */
export function findSpan(text, words) {
  if (typeof words !== "string" || !words.trim()) return undefined;
  const start = text.toLowerCase().indexOf(words.trim().toLowerCase());
  return start < 0 ? undefined : { start, end: start + words.trim().length };
}

/** A reading's details as spans of the message; undefined when it marks words the message does not have. */
export function markedSpans(message, marks) {
  const spans = {};
  for (const slot of protocol.ReaderSlot.options) {
    const words = marks[slot];
    if (words === null || words === undefined || words === "") continue;
    const span = findSpan(message, words);
    if (!span) return undefined;
    spans[slot] = span;
  }
  return spans;
}

const overlap = (a, b) => a.start < b.end && b.start < a.end;

/** Whether two readings agree: the same details, over overlapping words. */
function sameDetails(a, b) {
  const slots = Object.keys(a).sort().join();
  if (slots !== Object.keys(b).sort().join()) return Dropped.slots;
  return Object.entries(a).every(([slot, span]) => overlap(span, b[slot])) ? undefined : Dropped.words;
}

/** The target's details in the message: its words there as given, and marked by the reading as that detail. */
function targetMet(target, message, spans) {
  for (const [slot, words] of Object.entries(target.slots)) {
    if (!spans[slot]) return words === true ? Dropped.no_what : Dropped.slots;
    if (words === true) continue;
    const given = findSpan(message, words);
    if (!given) return Dropped.missing_words;
    if (!overlap(given, spans[slot])) return Dropped.words;
  }
  return undefined;
}

/** The kept example, in the shape the reader trains on; undefined when it breaks the schema (overlapping spans). */
export function toExample(target, message, spans) {
  const example = {
    text: message,
    ...(target.asking ? { asking: target.asking } : {}),
    turn: target.turn,
    spans: Object.entries(spans)
      .map(([slot, s]) => ({ slot, start: s.start, end: s.end }))
      .sort((a, b) => a.start - b.start),
  };
  const parsed = protocol.ReaderExample.safeParse(example);
  return parsed.success ? parsed.data : undefined;
}

/**
 * A need that only says what is wrong. The writer marks such a message loosely (its own words for the job, places it
 * did not write) and the labeller calls the problem's nouns the kind ("ants", "garden"), so code checks it instead: no
 * kind of work's words in it, and only the target's details kept from the labeller's marks, the given ones over their
 * given words.
 */
function judgeProblem(target, message, label) {
  if (namesWork(message)) return { dropped: Dropped.named_work };
  if (!label || typeof label.turn !== "string") return { dropped: Dropped.unlabelled };
  // Only the target's details: the writer was told to add none, so a detail marked beyond them is the labeller's own.
  const asked = Object.fromEntries(protocol.ReaderSlot.options.map((s) => [s, s in target.slots ? label[s] : null]));
  const labelled = markedSpans(message, asked);
  if (!labelled) return { dropped: Dropped.unlabelled };
  if (label.turn !== target.turn) return { dropped: Dropped.turn };
  const unmet = targetMet(target, message, labelled);
  if (unmet) return { dropped: unmet };
  const example = toExample(target, message, labelled);
  return example ? { example } : { dropped: Dropped.invalid };
}

/**
 * One target from the teacher's two readings: the writer's marks of its own message and the labeller's, made without
 * the target. Kept when the target's details are there and both readings agree; the labeller's spans are the ones
 * kept, so every example is marked by the same reader.
 */
export function judge(target, written, label) {
  if (!written || typeof written.message !== "string" || !written.message.trim()) return { dropped: Dropped.unwritten };
  const message = written.message.trim();
  if (isProblem(target)) return judgeProblem(target, message, label);
  const own = markedSpans(message, written);
  if (!own) return { dropped: Dropped.unwritten };
  if (!label || typeof label.turn !== "string") return { dropped: Dropped.unlabelled };
  const labelled = markedSpans(message, label);
  if (!labelled) return { dropped: Dropped.unlabelled };
  if (label.turn !== target.turn) return { dropped: Dropped.turn };
  if (WITHOUT_DETAILS.has(target.turn) && Object.keys(labelled).length > 0) return { dropped: Dropped.slots };
  const unmet = targetMet(target, message, labelled) ?? sameDetails(own, labelled);
  if (unmet) return { dropped: unmet };
  const example = toExample(target, message, labelled);
  return example ? { example } : { dropped: Dropped.invalid };
}
