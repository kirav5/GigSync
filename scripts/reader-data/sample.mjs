// A target for the teacher to write (ADR 0065 §5): the kind of message, the question open, and the words each detail
// must use. Drawn from a generator seeded by the run's seed and the target's number, so the same run draws the same
// targets on any machine, and a stopped run picks up where it was without drawing anything twice.
import { protocol } from "./core.mjs";
import { PHRASES, ReaderLang } from "./languages.mjs";

const Turn = protocol.TurnKind.enum;
const Slot = protocol.ReaderSlot.enum;

/** How often each kind of message is drawn: mostly needs, then answers to a question, then the rest. */
const TURN_WEIGHTS = [
  [Turn.need, 60],
  [Turn.answer, 20],
  [Turn.market, 8],
  [Turn.greeting, 6],
  [Turn.other, 6],
];
/** The questions an answer may be to. The kind is asked by the list, not in words. */
const ASKED = [Slot.where, Slot.when, Slot.how_long, Slot.what];

/** How likely a need says each detail; a need with no kind of work says what the job is instead. */
const NEED_SAYS = { kind: 0.75, group: 0.05, where: 0.4, when: 0.5, how_long: 0.25, what: 0.6 };
/** An answer that also says something it was not asked, as people do ("mornings, in HSR"). */
const ANSWER_ALSO = 0.2;
const MARKET_WHERE = 0.3;

/** Mulberry32: small, fast, and the same on every machine. */
export function generator(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** One target's own seed: the run's seed and its number mixed, so targets do not depend on each other. */
const targetSeed = (seed, id) => Math.imul(seed ^ 0x9e3779b9, 31) + Math.imul(id + 1, 0x85ebca6b);

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const chance = (rand, p) => rand() < p;

function weighted(rand, weights) {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [value, w] of weights) {
    roll -= w;
    if (roll < 0) return value;
  }
  return weights[weights.length - 1][0];
}

/** The words a detail must use: a kind's or group's name, a place, a time, how long; `what` the teacher writes. */
function wordsFor(rand, words, slot, kind) {
  if (slot === Slot.kind) return pick(rand, kind.words);
  if (slot === Slot.where) return pick(rand, words.WHERE);
  if (slot === Slot.when) return pick(rand, words.WHEN);
  if (slot === Slot.how_long) return pick(rand, words.HOW_LONG[pick(rand, protocol.Arrangement.options)]);
  return true;
}

function needSlots(rand, words, kind, group) {
  const slots = {};
  if (group) slots.kind = group.words;
  else if (chance(rand, NEED_SAYS.kind)) slots.kind = wordsFor(rand, words, Slot.kind, kind);
  for (const slot of [Slot.where, Slot.when, Slot.how_long])
    if (chance(rand, NEED_SAYS[slot])) slots[slot] = wordsFor(rand, words, slot, kind);
  if (!slots.kind || chance(rand, NEED_SAYS.what)) slots.what = true;
  return slots;
}

function answerSlots(rand, words, kind, asking) {
  const slots = { [asking]: wordsFor(rand, words, asking, kind) };
  const also = pick(
    rand,
    ASKED.filter((s) => s !== asking),
  );
  if (chance(rand, ANSWER_ALSO)) slots[also] = wordsFor(rand, words, also, kind);
  return slots;
}

/** A need that names no worker and no group, only what is wrong or what needs doing. */
export const isProblem = (target) => target.turn === Turn.need && !target.slots.kind;

/**
 * Target number `id` of a run. `kind` is the work the message is about, for the teacher's sense of the job; `slots`
 * are the details it must say, each with the words to use, or `true` for `what`, which the teacher words itself. A run
 * in another language than English draws the same way from that language's words, and its targets say which.
 */
export function drawTarget(seed, id, lang = ReaderLang.en) {
  const words = PHRASES[lang];
  const { GROUP_WORDS, KINDS, STYLES, WHERE } = words;
  const rand = generator(targetSeed(seed, id));
  const turn = weighted(rand, TURN_WEIGHTS);
  // A need named by its group is about one of the group's kinds, so the message and its target agree.
  const group = turn === Turn.need && chance(rand, NEED_SAYS.group) ? pick(rand, GROUP_WORDS) : undefined;
  const kind = group ? (KINDS.find((k) => k.kind === pick(rand, group.kinds)) ?? pick(rand, KINDS)) : pick(rand, KINDS);
  const style = pick(rand, STYLES);
  const base = { id, turn, kind: kind.kind, style, ...(lang === ReaderLang.en ? {} : { lang }) };
  if (turn === Turn.need) return { ...base, slots: needSlots(rand, words, kind, group) };
  if (turn === Turn.answer) {
    const asking = pick(rand, ASKED);
    return { ...base, asking, slots: answerSlots(rand, words, kind, asking) };
  }
  if (turn === Turn.market) {
    const slots = { kind: wordsFor(rand, words, Slot.kind, kind) };
    if (chance(rand, MARKET_WHERE)) slots.where = pick(rand, WHERE);
    return { ...base, slots };
  }
  return { ...base, slots: {} };
}
