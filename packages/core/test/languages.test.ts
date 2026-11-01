import { type Clarify, Lang, type QuestionKey } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { questionText, settle, TaskKind } from "../src/index.js";
import { ASHA, cook, cookNeed, MemoryRelay, phone, RAVI_HOME } from "./phones.js";

describe("two phones, two languages, one job", () => {
  it("questions cross as keys; each phone reads them in its owner's language; free text says its language", async () => {
    const relay = new MemoryRelay();
    const asha = await phone(relay, ASHA, { worker: cook(), lang: Lang.enum.hi });
    const ravi = await phone(relay, RAVI_HOME, { lang: Lang.enum.kn });
    const [job] = await ravi.device.request(cookNeed(), [asha.user]);
    const id = job?.engagement.id as never;
    await settle([ravi.device, asha.device]);

    // Asha's phone received Ravi's need tagged as Kannada, so it knows what to translate on receipt.
    const onAsha = await asha.device.job(id);
    expect(onAsha.request.lang).toBe(Lang.enum.kn);
    expect(onAsha.request.need).toBe(cookNeed().need);

    // Asha's agent asked the cook's three questions as keys; Ravi's agent had no answers, so it asked Ravi.
    const [ask] = await ravi.device.tasks();
    expect(ask?.kind).toBe(TaskKind.answerQuestions);
    const keys = ((ask?.detail ?? []) as Clarify["questions"]).map((q) => q.key);
    expect(keys).toEqual(["people", "meals", "pets"] satisfies QuestionKey[]);

    // Ravi reads them in Kannada; the same keys on Asha's phone read in Hindi. No sentence crossed.
    const forRavi = keys.map((k) => questionText(Lang.enum.kn, k));
    const forAsha = keys.map((k) => questionText(Lang.enum.hi, k));
    for (const s of forRavi) expect(s).toMatch(/[ಀ-೿]/);
    for (const s of forAsha) expect(s).toMatch(/[ऀ-ॿ]/);
  });

  it("a worker's note is tagged with the worker's language", async () => {
    const relay = new MemoryRelay();
    const asha = await phone(relay, ASHA, { worker: cook(), lang: Lang.enum.hi, autoConfirm: true });
    const ravi = await phone(relay, RAVI_HOME, { lang: Lang.enum.kn, autoConfirm: true });
    const details = { people: "3", meals: "breakfast, dinner", pets: "no" };
    const [job] = await ravi.device.request(cookNeed(950000, details), [asha.user]);
    const id = job?.engagement.id as never;
    await settle([ravi.device, asha.device]);
    expect((await ravi.device.job(id)).engagement.status).toBe("agreed");

    await asha.device.update(id, "निकल गई हूँ");
    await settle([ravi.device, asha.device]);
    // Ravi's phone has the note as Asha said it, marked Hindi, so it can translate it under the original.
    expect((await ravi.device.job(id)).notes).toEqual([
      { text: "निकल गई हूँ", lang: Lang.enum.hi, at: expect.any(String) },
    ]);
    // Asha's phone keeps her own note too, marked as hers, so her card says what she told Ravi.
    expect((await asha.device.job(id)).notes).toEqual([
      { text: "निकल गई हूँ", lang: Lang.enum.hi, at: expect.any(String), mine: true },
    ]);
    expect(JSON.stringify(relay.stored)).not.toContain("निकल"); // the relay only ever held ciphertext
  });
});
