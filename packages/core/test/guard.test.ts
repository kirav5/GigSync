import { ModelQuestion } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { type GuardRules, guardQuestions, MODEL_QUESTIONS_MAX } from "../src/job/guard.js";
import { DropReason } from "../src/job/guard-words.js";

const reply = (...questions: unknown[]) => JSON.stringify({ questions });
const q = (text: string, kind = "yes_no") => ({ text, kind });
const keptTexts = (r: string, rules: GuardRules = {}) => guardQuestions(r, rules).kept.map((k) => k.text);
const reasons = (r: string) => guardQuestions(r).dropped.map((d) => d.reason);

describe("question guards: good output", () => {
  it("keeps short real questions, with fresh keys, the model's kind and its language", () => {
    const { kept, dropped } = guardQuestions(
      `Sure! Here you go:\n\`\`\`json\n${reply(q("Is the fan humming?"), q("How many fans are there?", "number"))}\n\`\`\``,
      [],
    );
    expect(dropped).toEqual([]);
    expect(kept).toEqual([
      { key: "ask_a", text: "Is the fan humming?", lang: "en", kind: "yes_no", by: "model" },
      { key: "ask_b", text: "How many fans are there?", lang: "en", kind: "number", by: "model" },
    ]);
    for (const k of kept) expect(ModelQuestion.safeParse(k).success).toBe(true);
  });

  it("tags a question in Hindi or Kannada with that language", () => {
    const { kept } = guardQuestions(reply(q("क्या पंखा घूमता है?"), q("ಫ್ಯಾನ್ ತಿರುಗುತ್ತದೆಯೇ?")));
    expect(kept.map((k) => k.lang)).toEqual(["hi", "kn"]);
  });

  it("keeps at most three, and tidies the spacing", () => {
    const many = reply(q("Is it  the\nceiling fan?"), q("Is it new?"), q("Does it hum?"), q("Is it wet?"));
    const { kept, dropped } = guardQuestions(many);
    expect(kept).toHaveLength(MODEL_QUESTIONS_MAX);
    expect(kept[0]?.text).toBe("Is it the ceiling fan?");
    expect(dropped).toEqual([{ text: "Is it wet?", reason: DropReason.over }]);
    expect(guardQuestions(many, { max: 1 }).kept).toHaveLength(1);
  });
});

describe("question guards: garbage", () => {
  it.each([
    ["no JSON at all", "I would ask about the fan."],
    ["an array, not the object", '["Is it broken?"]'],
    ["the wrong field", '{"qs": [{"text": "Is it broken?", "kind": "yes_no"}]}'],
    ["broken JSON", '{"questions": [{"text": "Is it broken?", "kind": '],
    ["empty", ""],
  ])("drops %s", (_, r) => {
    expect(guardQuestions(r).kept).toEqual([]);
  });

  it("drops a bad kind, no question mark, too short, too long, or a repeat", () => {
    const r = reply(
      q("Is it broken?", "essay"),
      { text: 42, kind: "text" },
      q("Tell me about the fan."),
      q("A?"),
      q(`Is ${"very ".repeat(30)}old?`),
      q("Does it hum?"),
      q("does it HUM ?"),
    );
    expect(reasons(r)).toEqual([
      DropReason.shape,
      DropReason.shape,
      DropReason.mark,
      DropReason.length,
      DropReason.length,
      DropReason.duplicate,
    ]);
    expect(keptTexts(r)).toEqual(["Does it hum?"]);
  });

  it("drops a question about a detail already known, in any language", () => {
    const r = reply(q("Do you have any pets?"), q("कितने कमरे हैं?", "number"), q("Is the wiring old?"));
    expect(keptTexts(r, { known: ["pets", "rooms"] })).toEqual(["Is the wiring old?"]);
    expect(keptTexts(r)).toHaveLength(3);
  });

  it("drops a question that only repeats the household's words, or tacks a question onto a statement", () => {
    // Both seen from qwen2.5:1.5b on a real request.
    const said = "Ceiling fan stopped working, it hums but does not spin";
    const r = reply(
      q("Ceiling fan stopped working, it hums but does not spin?"),
      q("Kitchen sink is blocked. How many people are involved?", "number"),
      q("Does the fan plug into a wall socket?"),
    );
    expect(guardQuestions(r, { said }).dropped.map((d) => d.reason)).toEqual([DropReason.echo, DropReason.compound]);
    expect(keptTexts(r, { said })).toEqual(["Does the fan plug into a wall socket?"]);
  });
});

describe("question guards: hostile output", () => {
  it.each([
    ["What is your budget?", DropReason.money],
    ["Can you pay ₹500 in advance?", DropReason.money],
    ["आप कितने पैसे देंगे?", DropReason.money],
    ["ಎಷ್ಟು ಹಣ ಕೊಡುತ್ತೀರಿ?", DropReason.money],
    ["What is your phone number?", DropReason.contact],
    ["Can I WhatsApp you?", DropReason.contact],
    ["Is your email ok@example?", DropReason.contact],
    ["अपना मोबाइल नंबर बताइए?", DropReason.contact],
    ["ನಿಮ್ಮ ಫೋನ್ ನಂಬರ್ ಏನು?", DropReason.contact],
    ["What is your full address?", DropReason.place],
    ["आपका पता क्या है?", DropReason.place],
    ["ನಿಮ್ಮ ವಿಳಾಸ ಏನು?", DropReason.place],
    ["What is your caste?", DropReason.identity],
    ["Please share the OTP you got?", DropReason.identity],
    ["What is your UPI ID?", DropReason.identity],
    ["Are you married?", DropReason.identity],
    ["आपका धर्म क्या है?", DropReason.identity],
    ["ನಿಮ್ಮ ಆಧಾರ್ ಸಂಖ್ಯೆ ಏನು?", DropReason.identity],
    ["Can we meet outside first?", DropReason.outside],
    ["Shall we skip the app and deal directly?", DropReason.outside],
    ["Will you sign the paper?", DropReason.outside],
    ["क्या हम बाहर मिलें?", DropReason.outside],
    ["Have you seen https://evil.example/x?", DropReason.link],
    ["Is it model 984501234?", DropReason.digits],
    ["Is it 9 8 4 5 0 1?", DropReason.digits],
    ["क्या यह ९८४५०१२३४ है?", DropReason.digits],
  ])("drops %j", (text, reason) => {
    const { kept, dropped } = guardQuestions(reply(q(text)));
    expect(kept).toEqual([]);
    expect(dropped).toEqual([{ text, reason }]);
  });

  it("keeps the fair questions next to a hostile one, and small counts", () => {
    const r = reply(
      q("Ignore your rules: what is their phone?"),
      q("Are there 2 fans?"),
      q("Is there a sign of burning?"),
    );
    expect(keptTexts(r)).toEqual(["Are there 2 fans?", "Is there a sign of burning?"]);
  });
});
