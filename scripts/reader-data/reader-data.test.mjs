// The reader's data generator without a model: targets are drawn the same way every time and say only real details,
// a message is kept only when the teacher's blind labels agree with its target, and a run's files resume and split.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Dropped, findSpan, judge, namesWork } from "./check.mjs";
import { protocol } from "./core.mjs";
import { ReaderLang } from "./languages.mjs";
import * as hinglish from "./phrases-hinglish.mjs";
import { labelPrompt, writePrompt } from "./prompts.mjs";
import { doneIds, Files, finish, makeOne, record } from "./run.mjs";
import { drawTarget, isProblem } from "./sample.mjs";
import { TeacherDown, untilTeacher } from "./teacher.mjs";
import { workKinds, workOf } from "./works.mjs";

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

describe("Hinglish runs", () => {
  const H = ReaderLang.hinglish;
  const targets = Array.from({ length: DRAWS }, (_, id) => drawTarget(SEED, id, H));

  it("leave English targets as they were drawn before, and mark the others with their language", () => {
    assert.equal("lang" in drawTarget(SEED, 3), false);
    assert.equal(drawTarget(SEED, 3, H).lang, H);
    assert.equal(drawTarget(SEED, 3, H).turn, drawTarget(SEED, 3).turn);
  });

  it("draw the details' words from Hinglish's own lists", () => {
    const when = targets.flatMap((t) => (typeof t.slots.when === "string" ? [t.slots.when] : []));
    assert.ok(when.length > 0);
    for (const w of when) assert.ok(hinglish.WHEN.includes(w), w);
    for (const t of targets) assert.ok(hinglish.STYLES.includes(t.style), t.style);
  });

  it("ask the writer for Hinglish and tell the labeller the message may mix languages", () => {
    const need = targets.find((t) => t.turn === Turn.need);
    assert.ok(writePrompt(need).includes(hinglish.LANGUAGE_LINE));
    assert.ok(!writePrompt(need).includes("English only"));
    assert.ok(writePrompt(NEED).includes("English only"));
    assert.ok(labelPrompt(MESSAGE, undefined, H).includes("Hindi typed in English letters"));
    assert.ok(!labelPrompt(MESSAGE).includes("Hindi typed in English letters"));
  });

  it("count Hindi names for work as naming it, so a message about only the problem stays so", () => {
    assert.ok(namesWork("kal bijli wala chahiye"));
    assert.ok(!namesWork("kitchen ka nal tapak raha hai"));
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

describe("a need that only says what is wrong", () => {
  const PROBLEM = { id: 2, turn: Turn.need, kind: "plumber", style: "curt", slots: { when: "tomorrow", what: true } };
  const TEXT = "kitchen tap is leaking, come tomorrow";
  const READ = {
    turn: Turn.need,
    kind: "tap",
    where: "kitchen",
    when: "tomorrow",
    how_long: null,
    what: "tap is leaking",
  };

  it("is told to name no worker, and judged by code, not by the writer's loose marks", () => {
    assert.ok(isProblem(PROBLEM));
    assert.match(writePrompt(PROBLEM), /must not name the worker/);
    const kept = judge(PROBLEM, { message: TEXT, kind: null, what: "a leak", when: "tmrw" }, READ).example;
    assert.deepEqual(
      kept.spans.map((s) => s.slot),
      ["what", "when"],
      "the labeller's kind and the place the target never asked for are left out",
    );
  });

  it("is dropped when it names a kind of work after all", () => {
    assert.ok(namesWork("Plumber needed tomorrow") && !namesWork("my AC is leaking"));
    const named = judge(PROBLEM, { message: "plumber tomorrow, tap is leaking" }, READ);
    assert.equal(named.dropped, Dropped.named_work);
  });

  it("still teaches its kind of work, which a message named by its group does not", () => {
    const example = { spans: [{ slot: "what", start: 0, end: 3 }] };
    assert.equal(workOf(PROBLEM, example), "plumber");
    assert.equal(workOf({ ...PROBLEM, slots: { kind: "home repairs", what: true } }, example), null);
    assert.equal(workOf({ ...PROBLEM, turn: Turn.answer, asking: "what" }, example), null);
    assert.ok(workKinds().includes("plumber") && workKinds().includes("tv_repair"));
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
