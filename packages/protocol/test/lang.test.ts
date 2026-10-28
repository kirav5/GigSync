import { describe, expect, it } from "vitest";
import { Clarify, DEFAULT_LANG, JobRequest, Lang, Note, QuestionKey } from "../src/index.js";

const area = { lat: 12.97, lon: 77.64 };
const request = { trade: "cook", need: "ಅಡುಗೆ ಮಾಡುವವರು ಬೇಕು", when: "mon–sat 7–10", area };

describe("language on the wire", () => {
  it("a question is a key only, so no sentence in one language crosses to the other phone", () => {
    expect(Clarify.parse({ questions: [{ key: "pets" }] }).questions).toEqual([{ key: "pets" }]);
    expect(Clarify.safeParse({ questions: [{ key: "pets", text: "Any pets?" }] }).data?.questions[0]).toEqual({
      key: "pets",
    });
    expect(Clarify.safeParse({ questions: [{ key: "favourite_colour" }] }).success).toBe(false);
  });

  it("a request says which language its free text is in, English when the sender did not say", () => {
    expect(JobRequest.parse(request).lang).toBe(DEFAULT_LANG);
    expect(JobRequest.parse({ ...request, lang: "kn" }).lang).toBe(Lang.enum.kn);
    expect(JobRequest.safeParse({ ...request, lang: "xx" }).success).toBe(false);
  });

  it("a note carries its language too", () => {
    expect(Note.parse({ text: "निकल गई हूँ", lang: "hi" })).toEqual({ text: "निकल गई हूँ", lang: "hi" });
    expect(Note.parse({ text: "On my way" }).lang).toBe(DEFAULT_LANG);
  });

  it("every question key is a lowercase detail key, so answers can be stored under it", () => {
    for (const k of QuestionKey.options) expect(k).toMatch(/^[a-z][a-z_]{0,31}$/);
  });
});
