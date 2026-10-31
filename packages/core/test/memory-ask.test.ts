import { AnswerFromMemory, type EngagementId, type UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  AnswerSource,
  answerFromMemory,
  type Clock,
  Collection,
  isFresh,
  MEMORY_FRESH_DAYS,
  MemoryStorage,
  OwnerStorage,
  setAnswerFromMemory,
  settle,
  TaskKind,
} from "../src/index.js";
import { ASHA, cook, cookNeed, MemoryRelay, type Phone, phone, RAVI_HOME } from "./phones.js";

const { ask, auto } = AnswerFromMemory.enum;
const DAY_MS = 24 * 60 * 60 * 1000;
const FIRST_JOB = { people: "4", meals: "2", pets: "no" };

/** A clock a test moves by hand. */
class HandClock implements Clock {
  constructor(private at = new Date("2026-10-29T10:00:00+05:30")) {}
  now(): Date {
    return new Date(this.at);
  }
  advance(ms: number): void {
    this.at = new Date(this.at.getTime() + ms);
  }
}

const ownerOf = (p: Phone) => ({ storage: p.storage, me: { user: p.user } });

/** A household that hired Asha once (people, meals and pets given), then asks her again with no details. */
async function askedAgain(mode?: AnswerFromMemory, opts: { later?: number; details?: Record<string, string> } = {}) {
  const relay = new MemoryRelay();
  const clock = new HandClock();
  const home = await phone(relay, RAVI_HOME, { autoConfirm: true, clock });
  if (mode) await setAnswerFromMemory(ownerOf(home), mode);
  const asha = await phone(relay, ASHA, { worker: cook(), autoConfirm: true, clock });
  await home.device.request(cookNeed(1000000, FIRST_JOB), [asha.user]);
  await settle([home.device, asha.device]);
  clock.advance(opts.later ?? 0);
  const [job] = await home.device.request(cookNeed(1000000, opts.details), [asha.user]);
  await settle([home.device, asha.device]);
  const id = job?.engagement.id as EngagementId;
  return { home, asha, id, mine: () => home.device.job(id) };
}

describe("the setting: ask first, or answer for me", () => {
  it("is Ask me first until the owner chooses, and is kept per owner on a shared phone", async () => {
    const phone = new MemoryStorage();
    const owner = (user: UserId) => ({ storage: new OwnerStorage(phone, user), me: { user } });
    const priya = owner("usr_priya" as UserId);
    const ravi = owner("usr_ravi" as UserId);
    expect(await answerFromMemory(priya)).toBe(ask);
    await setAnswerFromMemory(priya, auto);
    expect(await answerFromMemory(priya)).toBe(auto);
    expect(await answerFromMemory(ravi)).toBe(ask);
  });

  it("a record that is not a setting counts as the default, and a bad one is never saved", async () => {
    const storage = new MemoryStorage();
    const owner = { storage, me: { user: "usr_priya" as UserId } };
    await storage.put(Collection.ownerSettings, "answer_from_memory", "always");
    expect(await answerFromMemory(owner)).toBe(ask);
    await expect(setAnswerFromMemory(owner, "always" as AnswerFromMemory)).rejects.toThrow();
  });
});

describe("a fact is used on its own only within a year", () => {
  it(`is fresh for ${MEMORY_FRESH_DAYS} days from the day it was last given, then not`, () => {
    const given = "2025-10-29";
    expect(isFresh(given, new Date(Date.parse(given) + MEMORY_FRESH_DAYS * DAY_MS))).toBe(true);
    expect(isFresh(given, new Date(Date.parse(given) + (MEMORY_FRESH_DAYS + 1) * DAY_MS))).toBe(false);
    expect(isFresh("not a day", new Date())).toBe(false);
  });
});

describe("Ask me first: the owner sees a remembered answer before it is sent", () => {
  it("opens the answer task filled in, and sends nothing yet", async () => {
    const { home, asha, id, mine } = await askedAgain();
    expect((await home.device.tasks()).map((t) => t.kind)).toEqual([TaskKind.answerQuestions]);
    const r = await mine();
    expect(r.answers ?? {}).toEqual({});
    expect(r.suggested).toEqual({
      people: { text: "4", fresh: true },
      meals: { text: "2", fresh: true },
      pets: { text: "no", fresh: true },
    });
    expect((await asha.device.job(id)).answers).toBeUndefined();
  });

  it("an answer sent as filled in is from past jobs; one the owner changed is theirs", async () => {
    const { home, asha, id, mine } = await askedAgain();
    await home.device.answer(id, { people: "4", meals: "3", pets: "no" });
    await settle([home.device, asha.device]);
    const r = await mine();
    expect(r.answered_from).toEqual({
      people: AnswerSource.memory,
      meals: AnswerSource.owner,
      pets: AnswerSource.memory,
    });
    expect(r.suggested).toBeUndefined();
    expect((await asha.device.job(id)).answers).toEqual({ people: "4", meals: "3", pets: "no" });
  });

  it("answers from this need's own words stay automatic", async () => {
    const { mine } = await askedAgain(ask, { details: { people: "3" } });
    const r = await mine();
    expect(r.request.details).toEqual({ people: "3" });
    expect(r.suggested).toEqual({ meals: { text: "2", fresh: true }, pets: { text: "no", fresh: true } });
  });

  it("a fact more than a year old is filled in as not fresh, for 'still right?'", async () => {
    const { mine } = await askedAgain(ask, { later: (MEMORY_FRESH_DAYS + 5) * DAY_MS });
    expect((await mine()).suggested?.people).toEqual({ text: "4", fresh: false });
  });
});

describe("Answer for me, with an old fact", () => {
  it("answers fresh facts itself, but asks a fact more than a year old fresh, with nothing filled in", async () => {
    const { home, mine } = await askedAgain(auto, { later: (MEMORY_FRESH_DAYS + 5) * DAY_MS });
    const r = await mine();
    expect(r.answers ?? {}).toEqual({});
    expect(r.suggested).toBeUndefined();
    const [task] = await home.device.tasks();
    expect(task?.detail).toEqual([{ key: "people" }, { key: "meals" }, { key: "pets" }]);
  });
});
