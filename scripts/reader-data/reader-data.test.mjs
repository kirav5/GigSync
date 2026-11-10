// The reader's data generator without a model: targets are drawn the same way every time and say only real details,
// a message is kept only when the teacher's blind labels agree with its target, and a run's files resume and split.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Dropped, findSpan, judge } from "./check.mjs";
import { protocol } from "./core.mjs";
import { labelPrompt, writePrompt } from "./prompts.mjs";
import { doneIds, Files, finish, makeOne, record } from "./run.mjs";
import { drawTarget } from "./sample.mjs";
import { TeacherDown, untilTeacher } from "./teacher.mjs";

const SEED = 7;
const DRAWS = 2000;
const Turn = protocol.TurnKind.enum;
const SLOTS = new Set(protocol.ReaderSlot.options);

const NEED = {
  id: 1,
  turn: Turn.need,
  kind: "maid",
  style: "curt",
  slots: { kind: "maid", when: "tomorrow", what: true },
};
const MESSAGE = "need maid tomorrow for 2bhk cleaning";
const MARKS = { kind: "maid", where: null, when: "tomorrow", how_long: null, what: "2bhk cleaning" };
const WRITTEN = { message: MESSAGE, ...MARKS };
const LABEL = { turn: Turn.need, ...MARKS };

describe("drawing targets", () => {
  it("draws the same target for the same seed and number, and others for others", () => {
    assert.deepEqual(drawTarget(SEED, 3), drawTarget(SEED, 3));
    assert.notDeepEqual(drawTarget(SEED, 3), drawTarget(SEED, 4));
    assert.notDeepEqual(drawTarget(SEED, 3), drawTarget(SEED + 1, 3));
  });

  it("asks only for real details, an answer for the one asked, and a need for its work one way or another", () => {
    const targets = Array.from({ length: DRAWS }, (_, id) => drawTarget(SEED, id));
    for (const t of targets) {
      assert.ok(protocol.TurnKind.options.includes(t.turn));
      for (const slot of Object.keys(t.slots)) assert.ok(SLOTS.has(slot), slot);
      if (t.turn === Turn.answer) assert.ok(t.asking in t.slots);
      if (t.turn === Turn.need) assert.ok(t.slots.kind || t.slots.what);
      if (t.turn === Turn.greeting || t.turn === Turn.other) assert.deepEqual(t.slots, {});
    }
    const needs = targets.filter((t) => t.turn === Turn.need).length / DRAWS;
    assert.ok(needs > 0.5 && needs < 0.7, `needs ${needs}`);
  });
});

describe("the prompts", () => {
  it("give the writer each detail's words as they must stand, and quote the message to the labeller", () => {
    const prompt = writePrompt(NEED);
    assert.ok(prompt.includes('include exactly "maid"'));
    assert.ok(prompt.includes('include exactly "tomorrow"'));
    assert.ok(labelPrompt(MESSAGE).includes(JSON.stringify(MESSAGE)));
    assert.ok(labelPrompt(MESSAGE, "when").includes("When do you need someone?"));
  });
});

describe("judging a message", () => {
  it("finds words whatever their case", () => {
    assert.deepEqual(findSpan("Need a Maid", "maid"), { start: 7, end: 11 });
    assert.equal(findSpan("Need a maid", "cook"), undefined);
  });

  it("keeps a message whose labels agree, with each detail at its place in the message", () => {
    const { example } = judge(NEED, WRITTEN, LABEL);
    assert.deepEqual(
      example.spans.map((s) => [s.slot, MESSAGE.slice(s.start, s.end)]),
      [
        ["kind", "maid"],
        ["when", "tomorrow"],
        ["what", "2bhk cleaning"],
      ],
    );
  });

  it("keeps details the target did not ask for when both readings mark them", () => {
    const message = "need maid tomorrow in HSR for 2bhk cleaning";
    const both = { ...MARKS, where: "HSR" };
    const { example } = judge(NEED, { message, ...both }, { turn: Turn.need, ...both });
    assert.deepEqual(
      example.spans.map((s) => s.slot),
      ["kind", "when", "where", "what"],
    );
  });

  it("drops a message missing the target's words, or read two ways, or another kind of message", () => {
    const cook = { message: "need cook tomorrow for 2bhk cleaning", ...MARKS, kind: "cook" };
    assert.equal(judge(NEED, cook, { ...LABEL, kind: "cook" }).dropped, Dropped.missing_words);
    assert.equal(judge(NEED, WRITTEN, { ...LABEL, what: null }).dropped, Dropped.no_what);
    assert.equal(judge(NEED, WRITTEN, { ...LABEL, turn: Turn.market }).dropped, Dropped.turn);
    assert.equal(judge(NEED, WRITTEN, { ...LABEL, how_long: "2bhk" }).dropped, Dropped.slots);
    assert.equal(judge(NEED, WRITTEN, { ...LABEL, what: "need" }).dropped, Dropped.words);
    assert.equal(judge(NEED, WRITTEN, { ...LABEL, when: "maid" }).dropped, Dropped.words);
    assert.equal(judge(NEED, WRITTEN, { ...LABEL, what: "not in it" }).dropped, Dropped.unlabelled);
    assert.equal(judge(NEED, { ...WRITTEN, where: "not in it" }, LABEL).dropped, Dropped.unwritten);
    assert.equal(judge(NEED, { message: "" }, LABEL).dropped, Dropped.unwritten);
  });

  it("drops a greeting or other message that is marked with details", () => {
    const other = { id: 2, turn: Turn.other, kind: "maid", style: "curt", slots: {} };
    const message = "app not loading on my phone";
    const marks = { ...MARKS, kind: null, when: null, what: "app not loading" };
    assert.equal(judge(other, { message, ...marks }, { turn: Turn.other, ...marks }).dropped, Dropped.slots);
    const none = { kind: null, where: null, when: null, how_long: null, what: null };
    assert.ok(judge(other, { message, ...none }, { turn: Turn.other, ...none }).example);
  });

  it("drops details that overlap, since one word is one detail at most", () => {
    const target = { ...NEED, slots: { kind: "maid", what: true } };
    const both = { ...MARKS, when: null, what: "maid tomorrow" };
    assert.equal(judge(target, { ...WRITTEN, ...both }, { turn: Turn.need, ...both }).dropped, Dropped.invalid);
  });
});

describe("a teacher that is down", () => {
  it("is waited for, not taken as a dropped target", async () => {
    const down = async () => {
      throw new TeacherDown("fetch failed");
    };
    await assert.rejects(makeOne(NEED, down), TeacherDown);
    let checks = 0;
    await untilTeacher(async () => ++checks >= 3, 1);
    assert.equal(checks, 3);
  });
});

describe("a run", () => {
  const teacher = (label) => async (prompt) => (prompt.startsWith("Mark") ? label : WRITTEN);

  it("writes kept and dropped targets as they come, resumes, and splits by number", async () => {
    const dir = mkdtempSync(join(tmpdir(), "reader-data-"));
    for (const id of [0, 1, 2]) record(dir, { ...NEED, id }, await makeOne({ ...NEED, id }, teacher(LABEL)));
    record(dir, { ...NEED, id: 3 }, await makeOne({ ...NEED, id: 3 }, teacher({ ...LABEL, turn: Turn.other })));
    assert.deepEqual([...doneIds(dir)].sort(), [0, 1, 2, 3]);
    const manifest = finish(dir, { seed: SEED });
    assert.equal(manifest.kept, 3);
    assert.equal(manifest.dev, 1);
    assert.deepEqual(manifest.dropped, { [Dropped.turn]: 1 });
    const dropped = JSON.parse(readFileSync(join(dir, Files.dropped), "utf8"));
    assert.equal(dropped.message, MESSAGE);
  });
});
