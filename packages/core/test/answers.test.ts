import {
  AnswerFromMemory,
  type EngagementId,
  FREE_QUESTIONS_PROTOCOL,
  type ModelQuestion,
  SKIPPED,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { AnswerSource, agentTalk, setAnswerFromMemory, settle, TalkKind, TaskKind } from "../src/index.js";
import { groundedAnswers } from "../src/job/answer-model.js";
import { FakeModel, questionsReply } from "./model-fakes.js";
import {
  ASHA,
  cook,
  cookNeed,
  electrician,
  fanNeed,
  MemoryRelay,
  type Phone,
  PRIYA,
  phone,
  RAVI,
  RAVI_HOME,
} from "./phones.js";

const NEW = { protocol: FREE_QUESTIONS_PROTOCOL };
const HUM = { text: "Does the fan hum when switched on?", kind: "yes_no" };
const FANS = { text: "How many fans need checking?", kind: "number" };
const PEOPLE = { text: "How many people will eat?", kind: "number" };
/** The owner chose "Answer for me" in Profile. */
const answerForMe = (p: Phone) =>
  setAnswerFromMemory({ storage: p.storage, me: { user: p.user } }, AnswerFromMemory.enum.auto);

describe("a written question between two phones", () => {
  it("reaches the household, is answered by the owner, and stays out of the price and the scope", async () => {
    const relay = new MemoryRelay();
    const priya = await phone(relay, PRIYA, { ...NEW, autoConfirm: true });
    const ravi = await phone(relay, RAVI, { worker: electrician(), model: new FakeModel(questionsReply(HUM)) });
    const [job] = await priya.device.request(fanNeed(), [ravi.user]);
    const id = job?.engagement.id as EngagementId;
    await settle([priya.device, ravi.device]);
    const [task] = await priya.device.tasks();
    expect(task?.detail).toEqual([{ key: "ask_a", text: HUM.text, kind: "yes_no", lang: "en", by: "model" }]);

    await priya.device.answer(id, { ask_a: "yes" });
    await settle([priya.device, ravi.device]);
    const onRavi = await ravi.device.job(id);
    expect(onRavi.answers).toEqual({ ask_a: "yes" });
    expect(onRavi.request.details).toEqual({});
    expect(onRavi.offers[0]?.offer.scope).toBe("Ceiling fan stopped working");
    const onPriya = await priya.device.job(id);
    expect(onPriya.answered_from).toEqual({ ask_a: AnswerSource.owner });
    // The household's need keeps no model key: another worker's agent may mean something else by "ask_a".
    expect((await priya.device.store.need(onPriya.engagement.group))?.details).toEqual({});

    for (const r of [onPriya, onRavi]) {
      const talk = agentTalk(r);
      expect(talk.find((s) => s.kind === TalkKind.questions)).toMatchObject({ questions: [{ text: HUM.text }] });
      expect(talk.find((s) => s.kind === TalkKind.answers)).toMatchObject({ answers: [{ text: "yes" }] });
    }
  });

  it("sends a skipped answer as skipped, and neither phone treats it as a detail", async () => {
    const relay = new MemoryRelay();
    const priya = await phone(relay, PRIYA, NEW);
    const ravi = await phone(relay, RAVI, { worker: { ...electrician(), ask_me: ["problem"] } });
    const [job] = await priya.device.request(fanNeed(), [ravi.user]);
    const id = job?.engagement.id as EngagementId;
    await settle([priya.device, ravi.device]);
    await priya.device.answer(id, { problem: "  " });
    await settle([priya.device, ravi.device]);
    const onRavi = await ravi.device.job(id);
    expect(onRavi.answers).toEqual({ problem: SKIPPED });
    expect(onRavi.request.details).toEqual({});
    // Nothing for Ravi to approve: a skipped detail is not a detail.
    expect((await ravi.device.tasks()).map((t) => t.kind)).not.toContain(TaskKind.approveRequest);
    expect((await priya.device.store.need(job?.engagement.group as EngagementId))?.details).toEqual({});
  });
});

describe("the household's agent answers from its owner's words (and past jobs, with Answer for me)", () => {
  it("answers a written question about a detail remembered from a past job, as a number", async () => {
    const relay = new MemoryRelay();
    const home = await phone(relay, RAVI_HOME, { ...NEW, autoConfirm: true });
    await answerForMe(home);
    const asha = await phone(relay, ASHA, { worker: cook(), autoConfirm: true });
    await home.device.request(cookNeed(1000000, { people: "4 ಜನ", meals: "2", pets: "no" }), [asha.user]);
    await settle([home.device, asha.device]);

    // A new cook, whose model asks about something her household's agent remembers but she does not.
    const model = new FakeModel(questionsReply(PEOPLE));
    const other = await phone(relay, PRIYA, { worker: cook(), model, autoConfirm: true });
    const [again] = await home.device.request(cookNeed(1000000), [other.user]);
    await settle([home.device, other.device]);
    expect((await home.device.tasks()).map((t) => t.kind)).not.toContain(TaskKind.answerQuestions);
    const r = await home.device.job(again?.engagement.id as EngagementId);
    expect(r.answers).toEqual({ ask_a: "4" });
    expect(r.answered_from).toEqual({ ask_a: AnswerSource.memory });
  });

  it("lets its own model match a question to the owner's words, only with a real quote", async () => {
    const relay = new MemoryRelay();
    const reply = JSON.stringify({
      answers: [
        { key: "ask_a", answer: "yes", quote: "it hums" },
        { key: "ask_b", answer: 3, quote: "three fans" },
      ],
    });
    const priya = await phone(relay, PRIYA, { ...NEW, model: new FakeModel(reply) });
    const ravi = await phone(relay, RAVI, { worker: electrician(), model: new FakeModel(questionsReply(HUM, FANS)) });
    const need = { ...fanNeed(), need: "Ceiling fan stopped working, it hums but does not spin" };
    const [job] = await priya.device.request(need, [ravi.user]);
    await settle([priya.device, ravi.device]);
    const r = await priya.device.job(job?.engagement.id as EngagementId);
    // "three fans" is not in her words: that one is hers to answer.
    expect(r.answers).toEqual({ ask_a: "yes" });
    expect((await priya.device.tasks())[0]?.detail).toMatchObject([{ key: "ask_b" }]);
  });

  it("answers standard questions from a past signed job, and says so", async () => {
    const relay = new MemoryRelay();
    const home = await phone(relay, RAVI_HOME, { autoConfirm: true });
    await answerForMe(home);
    const asha = await phone(relay, ASHA, { worker: cook(), autoConfirm: true });
    await home.device.request(cookNeed(1000000, { people: "4", meals: "2", pets: "no" }), [asha.user]);
    await settle([home.device, asha.device]);

    const [again] = await home.device.request(cookNeed(1000000), [asha.user]);
    await settle([home.device, asha.device]);
    expect(await home.device.tasks()).toEqual([]);
    const r = await home.device.job(again?.engagement.id as EngagementId);
    expect(r.answers).toEqual({ people: "4", meals: "2", pets: "no" });
    expect(Object.values(r.answered_from ?? {})).toEqual([
      AnswerSource.memory,
      AnswerSource.memory,
      AnswerSource.memory,
    ]);
    const answers = agentTalk(r).find((s) => s.kind === TalkKind.answers);
    expect(answers).toMatchObject({ answers: [{ source: AnswerSource.memory }, {}, {}] });
  });
});

describe("grounding a model's answers", () => {
  const q = (key: string, kind: ModelQuestion["kind"]): ModelQuestion => ({
    key,
    text: "Is it so?",
    kind,
    lang: "en",
    by: "model",
  });
  const words = "Kitchen tap leaks, two taps in the bathroom too";
  const ground = (answers: unknown[], qs = [q("ask_a", "text")]) =>
    groundedAnswers(JSON.stringify({ answers }), words, qs);

  it("keeps a quote that is in the owner's words, as the owner wrote it", () => {
    expect(ground([{ key: "ask_a", answer: "the kitchen", quote: "Kitchen tap leaks" }])).toEqual({
      ask_a: "Kitchen tap leaks",
    });
  });

  it("drops an invented quote, a number not in the quote, a no, and unknown keys", () => {
    expect(ground([{ key: "ask_a", answer: "x", quote: "the geyser is broken" }])).toEqual({});
    expect(ground([{ key: "ask_a", answer: 3, quote: "two taps" }], [q("ask_a", "number")])).toEqual({});
    expect(ground([{ key: "ask_a", answer: "no", quote: "Kitchen tap" }], [q("ask_a", "yes_no")])).toEqual({});
    expect(ground([{ key: "ask_z", answer: "x", quote: "Kitchen tap" }])).toEqual({});
    expect(groundedAnswers("no json here", words, [q("ask_a", "text")])).toEqual({});
  });
});
