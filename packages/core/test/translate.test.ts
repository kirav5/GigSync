import { Lang } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  asciiDigits,
  NO_TRANSLATOR,
  numbersKept,
  plural,
  type TranslateEngine,
  TranslateState,
  TranslationKind,
  Translations,
} from "../src/index.js";

const { hi, kn, en } = Lang.enum;

/** An engine that answers from a table and counts its calls. */
function tableEngine(table: Record<string, string>, state: TranslateState = TranslateState.available) {
  const calls: string[] = [];
  const engine: TranslateEngine = {
    name: "table",
    state: async () => state,
    prepare: async () => state,
    translate: async (text) => {
      calls.push(text);
      return table[text];
    },
  };
  return { engine, calls };
}

describe("numbers survive translation or the translation is withheld", () => {
  it("accepts the same numbers in another script, and extra numbers", () => {
    expect(numbersKept("ಸೋಮ–ಶನಿ ಬೆಳಗ್ಗೆ 7–10", "सोम–शनि सुबह ७–१०")).toBe(true);
    expect(numbersKept("third floor", "3rd floor")).toBe(true);
  });

  it("rejects a dropped or changed amount", () => {
    expect(numbersKept("₹9,500 a month", "₹9,000 a month")).toBe(false);
    expect(numbersKept("come at 7", "come in the morning")).toBe(false);
  });
});

describe("Translations", () => {
  it("translates once per text and pair, then answers from memory", async () => {
    const { engine, calls } = tableEngine({ "ಬೆಳಗ್ಗೆ ಅಡುಗೆ": "सुबह खाना" });
    const tr = new Translations(engine);
    const first = await tr.translate("ಬೆಳಗ್ಗೆ ಅಡುಗೆ", kn, hi);
    expect(first).toEqual({ kind: TranslationKind.translated, text: "सुबह खाना" });
    await tr.translate("ಬೆಳಗ್ಗೆ ಅಡುಗೆ", kn, hi);
    expect(calls).toHaveLength(1);
  });

  it("withholds a translation that changed a number", async () => {
    const { engine } = tableEngine({ "₹500 more": "₹50 अधिक" });
    expect(await new Translations(engine).translate("₹500 more", en, hi)).toEqual({ kind: TranslationKind.unsafe });
  });

  it("reports a pair that needs a download, and asks again next time", async () => {
    const { engine } = tableEngine({}, TranslateState.downloadable);
    const tr = new Translations(engine);
    expect(await tr.translate("hello", en, kn)).toEqual({
      kind: TranslationKind.unavailable,
      state: TranslateState.downloadable,
    });
  });

  it("on a phone with no engine, everything is unavailable and nothing throws", async () => {
    expect((await new Translations(NO_TRANSLATOR).translate("x", en, hi)).kind).toBe(TranslationKind.unavailable);
  });
});

describe("digits typed in any script", () => {
  it("become Western digits, everything else untouched", () => {
    expect(asciiDigits("+९१ ९८००")).toBe("+91 9800");
    expect(asciiDigits("೯೫೦೦")).toBe("9500");
    expect(asciiDigits("ref 41234")).toBe("ref 41234");
  });
});

describe("plurals follow each language's own rules", () => {
  it("English one and other; Hindi and Kannada treat 0 and 1 alike", () => {
    expect(plural(en, "find.ask", 1)).toBe("Ask 1 worker");
    expect(plural(en, "find.ask", 3)).toBe("Ask 3 workers");
    expect(plural(hi, "find.ask", 1)).toBe("1 कामगार से पूछें");
    expect(plural(hi, "find.ask", 2)).toBe("2 कामगारों से पूछें");
  });
});
