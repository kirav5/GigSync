import { type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  aboutIsPrivate,
  askable,
  type CardDraft,
  CITY_RATES,
  choose,
  draftOf,
  edit,
  hear,
  type InterviewState,
  prompt,
  Slot,
  start,
  withConfig,
} from "../src/index.js";

const T = Trade.enum;
const AREAS = [
  { key: "koramangala", names: ["Koramangala", "कोरमंगला", "ಕೋರಮಂಗಲ"] },
  { key: "hsr_layout", names: ["HSR Layout", "एचएसआर लेआउट", "ಎಚ್‌ಎಸ್‌ಆರ್ ಲೇಔಟ್", "HSR", "ಎಚ್‌ಎಸ್‌ಆರ್"] },
  { key: "jayanagar", names: ["Jayanagar", "जयनगर", "ಜಯನಗರ"] },
];
const config = (own: Lang) => ({ own, areas: AREAS, rates: CITY_RATES });
/** Answers in turn, typed unless `aloud`. */
const run = (state: InterviewState, answers: readonly string[], aloud = false) =>
  answers.reduce((s, answer) => hear(s, answer, aloud), state);
const keys = (state: InterviewState) => prompt(state).lines.map((l) => l.key);
/** What a cook is shown under each rate question: the city's range, the legal minimum, and that it is unchecked. */
const COOK_HINT = ["iv.band_month", "iv.legal_min", "iv.band_seed"];
const FULL: CardDraft = {
  trades: [T.cook],
  area: "koramangala",
  rate_paise: 900000,
  limit_paise: 750000,
  languages: ["hi"],
  ask_me: [],
  auto: false,
};

describe("the card interview, start to finish", () => {
  it("runs in Hindi, by voice", () => {
    const first = start(config("hi"));
    expect(keys(first)).toEqual(["iv.start", "iv.ask.trade"]);
    const atConfirm = run(
      first,
      ["मैं खाना बनाती हूँ", "हर महीने", "कोरमंगला", "नौ हज़ार", "साढ़े सात हज़ार", "कोई नहीं", "छोड़ो", "हाँ ना", "नहीं"],
      true,
    );
    expect(atConfirm.slot).toBe(Slot.confirm);
    const summary = prompt(atConfirm).lines;
    // Trades and the area go as catalog keys, so the summary is in whatever language the phone shows it in.
    expect(summary[0]).toEqual({
      key: "iv.summary",
      names: { trades: ["trade.cook"], area: ["area.koramangala"] },
      prices: { rate: 900000 },
    });
    expect(summary.find((l) => l.key === "iv.summary_min")).toMatchObject({ prices: { min: 750000 } });
    expect(summary.map((l) => l.key)).toContain("iv.summary_auto_off");
    const done = hear(atConfirm, "हाँ");
    expect(done.slot).toBe(Slot.done);
    expect(draftOf(done)).toEqual({
      trades: [T.cook],
      arrangements: ["monthly"],
      area: "koramangala",
      rate_paise: 900000,
      limit_paise: 750000,
      languages: ["hi"],
      ask_me: ["pets"],
      auto: false,
    });
  });

  it("runs in Kannada, typed and tapped, changing the rate after a no at confirm", () => {
    let s = run(start(config("kn")), ["ಅಡುಗೆ", "ತಿಂಗಳಿಗೆ"]);
    expect(prompt(s).choices?.map((c) => c.value)).toEqual(["koramangala", "hsr_layout", "jayanagar"]);
    s = choose(s, "jayanagar");
    s = run(s, ["ಎಂಟು ಸಾವಿರ", "ಏಳು ಸಾವಿರ", "ಹಿಂದಿ", "ಹತ್ತು ವರ್ಷದ ಅನುಭವ", "ಇಲ್ಲ", "ಹೌದು", "ಇಲ್ಲ"]);
    expect(s.slot).toBe(Slot.confirm);
    expect(keys(s)).toEqual(["iv.what_change"]);
    s = hear(s, "ದರ");
    expect(s.slot).toBe(Slot.rate);
    expect(keys(s)).toEqual(["iv.ask.rate_month", ...COOK_HINT]);
    s = hear(s, "ಎಂಟೂವರೆ ಸಾವಿರ");
    expect(s.slot).toBe(Slot.confirm);
    expect(keys(s)[0]).toBe("iv.got_rate");
    expect(keys(s).at(-1)).toBe("iv.confirm");
    expect(draftOf(hear(s, "ಹೌದು"))).toMatchObject({
      area: "jayanagar",
      rate_paise: 850000,
      limit_paise: 700000,
      languages: ["kn", "hi"],
      about: "ಹತ್ತು ವರ್ಷದ ಅನುಭವ",
      ask_me: [],
      auto: true,
    });
  });

  it("runs in English, typed, skipping the ask-first question for a trade without one", () => {
    const s = run(start(config("en")), [
      "electrician",
      "HSR",
      "500",
      "400",
      "Hindi and Kannada",
      "10 years, wiring and fans",
    ]);
    expect(s.slot).toBe(Slot.auto);
    const done = run(s, ["yes", "yes"]);
    expect(done.slot).toBe(Slot.done);
    expect(draftOf(done)).toMatchObject({
      trades: [T.electrician],
      area: "hsr_layout",
      rate_paise: 50000,
      limit_paise: 40000,
      languages: ["en", "hi", "kn"],
      about: "10 years, wiring and fans",
      auto: true,
    });
  });
});

describe("the card interview's checks", () => {
  const atRate = run(start(config("hi")), ["कुक", "महीने का", "कोरमंगला"]);

  it("asks a monthly trade for its monthly rate, and needs an amount", () => {
    expect(keys(atRate)).toEqual(["iv.ask.rate_month", ...COOK_HINT]);
    expect(prompt(atRate).numeric).toBe(true);
    expect(keys(hear(atRate, "पता नहीं"))).toEqual(["iv.again.amount", "iv.ask.rate_month", ...COOK_HINT]);
  });

  it("reads the rate back before asking the minimum", () => {
    expect(keys(hear(atRate, "नौ हज़ार"))).toEqual(["iv.got_rate", "iv.ask.min", "iv.legal_min"]);
  });

  it("refuses a minimum above the rate", () => {
    const s = run(atRate, ["नौ हज़ार", "दस हज़ार"]);
    expect(s.slot).toBe(Slot.min);
    expect(prompt(s).lines[0]).toEqual({ key: "iv.err_min", prices: { price: 900000 } });
  });

  it("checks an amount ten times the city's usual before keeping it", () => {
    const check = hear(atRate, "एक लाख बीस हज़ार");
    expect(check.slot).toBe(Slot.rate);
    expect(prompt(check).lines).toEqual([{ key: "iv.check_amount", prices: { price: 12000000 } }]);
    expect(prompt(check).choices?.map((c) => c.key)).toEqual(["flag.yes", "flag.no"]);
    expect(draftOf(choose(check, "yes")).rate_paise).toBe(12000000);
    expect(keys(hear(check, "नहीं"))).toEqual(["iv.again.amount", "iv.ask.rate_month", ...COOK_HINT]);
    expect(draftOf(hear(check, "नहीं, बारह हज़ार")).rate_paise).toBe(1200000);
    expect(draftOf(hear(check, "एक लाख बीस हज़ार")).rate_paise).toBe(12000000);
  });

  it("checks a minimum far below the city's usual", () => {
    const s = run(atRate, ["नौ हज़ार", "सात सौ"]);
    expect(prompt(s).lines[0]).toMatchObject({ key: "iv.check_amount", prices: { price: 70000 } });
  });

  it("speaks the minimum back only when it was said aloud, and never the summary's minimum", () => {
    const atMin = hear(atRate, "नौ हज़ार");
    expect(hear(atMin, "सात हज़ार", true).notes).toEqual([{ key: "iv.got_min", prices: { price: 700000 } }]);
    const typed = hear(atMin, "सात हज़ार");
    expect(typed.notes).toEqual([{ key: "iv.got_min", prices: { price: 700000 }, silent: true }]);
    const confirm = prompt(run(typed, ["हिंदी", "छोड़ो", "नहीं", "नहीं"])).lines;
    expect(confirm.find((l) => l.key === "iv.summary_min")?.silent).toBe(true);
    expect(confirm.filter((l) => l.silent).length).toBe(1);
  });

  it("checks a typed minimum quietly, and a spoken yes does not read it out", () => {
    const atMin = hear(atRate, "नौ हज़ार");
    expect(prompt(hear(atMin, "सात सौ", true)).lines[0]).toEqual({ key: "iv.check_amount", prices: { price: 70000 } });
    const typed = hear(atMin, "सात सौ");
    expect(prompt(typed).lines[0]).toEqual({ key: "iv.check_amount", prices: { price: 70000 }, silent: true });
    expect(hear(typed, "हाँ", true).notes[0]?.silent).toBe(true);
    expect(choose(typed, "yes").notes[0]?.silent).toBe(true);
    expect(hear(hear(atMin, "सात सौ", true), "हाँ").notes[0]?.silent).toBeUndefined();
  });

  it("keeps the minimum from any company's recognizer, and only the minimum", () => {
    const atMin = hear(atRate, "नौ हज़ार");
    expect(prompt(atMin).secret).toBe(true);
    expect(prompt(hear(atMin, "सात सौ")).secret).toBe(true);
    expect(prompt(atRate).secret).toBeUndefined();
    expect(prompt(hear(atMin, "सात हज़ार")).secret).toBeUndefined();
  });

  it("keeps phone numbers, UPI IDs and long text off the public card", () => {
    const atAbout = run(atRate, ["नौ हज़ार", "सात हज़ार", "कोई नहीं"]);
    expect(atAbout.slot).toBe(Slot.about);
    expect(keys(hear(atAbout, "मुझे 98450 12345 पर बुलाइए"))[0]).toBe("iv.err_private");
    expect(keys(hear(atAbout, "पैसे lata@okaxis पर"))[0]).toBe("iv.err_private");
    expect(keys(hear(atAbout, "बहुत ".repeat(80)))[0]).toBe("iv.err_long");
    expect(aboutIsPrivate("call ९८४५० १२३४५")).toBe(true);
    expect(aboutIsPrivate("दस साल का अनुभव")).toBe(false);
    expect(hear(atAbout, "दस साल का अनुभव").slot).toBe(Slot.ask_first);
    expect(choose(atAbout, "skip").slot).toBe(Slot.ask_first);
  });

  it("asks before quoting only for trades whose agents ask a yes-or-no detail", () => {
    expect(askable([T.maid])).toEqual(["pets"]);
    expect(askable([T.cook])).toEqual(["pets"]);
    expect(askable([T.electrician, T.plumber, T.carpenter, T.ac_technician, T.painter, T.driver])).toEqual([]);
  });

  it("settles on no after two unclear answers to auto-signing", () => {
    const atAuto = run(atRate, ["नौ हज़ार", "सात हज़ार", "कोई नहीं", "छोड़ो", "नहीं"]);
    expect(atAuto.slot).toBe(Slot.auto);
    const unclear = run(atAuto, ["क्या", "क्या"]);
    expect(unclear.slot).toBe(Slot.confirm);
    expect(draftOf(unclear).auto).toBe(false);
    expect(keys(hear(atAuto, "क्या"))).toEqual(["iv.again.yes_no", "iv.ask.auto"]);
  });

  it("settles on the owner's language alone after two unclear answers", () => {
    const atLanguages = run(atRate, ["नौ हज़ार", "सात हज़ार"]);
    expect(keys(hear(atLanguages, "पता नहीं"))[0]).not.toBe("iv.again.languages");
    const s = run(atLanguages, ["कुछ और", "कुछ और"]);
    expect(s.slot).toBe(Slot.about);
    expect(draftOf(s).languages).toEqual(["hi"]);
  });

  it("follows a change of language part-way, keeping the answers", () => {
    const atLanguages = run(start(config("en")), ["cook", "monthly", "Koramangala", "9000", "7000"]);
    const switched = withConfig(atLanguages, config("hi"));
    expect(draftOf(switched)).toEqual(draftOf(atLanguages));
    const ask = prompt(switched);
    expect(ask.lines).toEqual([{ key: "iv.ask.languages", names: { lang: ["lang.hi"] } }]);
    // The recognizer now listens for Hindi words.
    expect(ask.hints.length).toBeGreaterThan(0);
    expect(ask.hints.every((h) => /\p{Script=Devanagari}/u.test(h))).toBe(true);
    expect(ask.choices?.map((c) => c.value)).toEqual(["en", "kn", "none"]);
  });

  it("ignores a tap the prompt did not offer", () => {
    expect(choose(atRate, "yes")).toBe(atRate);
    expect(choose(start(config("hi")), "plumbing")).toEqual(start(config("hi")));
  });
});

describe("changing a card the owner already has", () => {
  it("opens on the summary and what to change", () => {
    const s = start(config("hi"), FULL);
    expect(s.slot).toBe(Slot.confirm);
    const lines = keys(s);
    expect(lines[0]).toBe("iv.summary");
    expect(lines.at(-1)).toBe("iv.what_change");
    expect(lines).not.toContain("iv.start");
    expect(prompt(s).choices?.map((c) => c.value)).toEqual([
      Slot.trade,
      Slot.area,
      Slot.rate,
      Slot.min,
      Slot.languages,
      Slot.about,
      Slot.auto,
    ]);
  });

  it("changes one field and comes back to confirm", () => {
    const s = choose(start(config("hi"), FULL), Slot.area);
    expect(keys(s)).toEqual(["iv.ask.area"]);
    const back = hear(s, "जयनगर");
    expect(back.slot).toBe(Slot.confirm);
    expect(keys(back).at(-1)).toBe("iv.confirm");
    expect(draftOf(back)).toEqual({ ...FULL, area: "jayanagar" });
  });

  it("asks the minimum again when a new rate falls below it", () => {
    const s = run(edit(start(config("hi"), FULL), Slot.rate), ["सात हज़ार"]);
    expect(keys(s)).toEqual(["iv.got_rate", "iv.ask.min", "iv.legal_min"]);
    expect(draftOf(hear(s, "छह हज़ार"))).toMatchObject({ rate_paise: 700000, limit_paise: 600000 });
    expect(hear(s, "छह हज़ार").slot).toBe(Slot.confirm);
  });

  it("asks the new trade's ask-first question after changing the trade", () => {
    const electrician = { ...FULL, trades: [T.electrician], rate_paise: 50000, limit_paise: 40000 };
    const s = run(edit(start(config("hi"), electrician), Slot.trade), ["घर का काम"]);
    // A maid says which work she takes first (ADR 0046), then her rate for it, in that unit.
    expect(s.slot).toBe(Slot.arrangements);
    const atRate = hear(s, "महीने के हिसाब से");
    expect(atRate.slot).toBe(Slot.rate);
    expect(prompt(atRate).lines.some((l) => l.key === "iv.ask.rate_month")).toBe(true);
  });

  it("goes back to the summary when there is nothing to change", () => {
    const s = hear(start(config("hi"), FULL), "कुछ नहीं");
    expect(keys(s).at(-1)).toBe("iv.confirm");
  });

  it("jumps to a field named with a change word at confirm", () => {
    const atConfirm = hear(start(config("hi"), FULL), "नहीं");
    expect(hear(atConfirm, "रेट बदलो").slot).toBe(Slot.rate);
  });
});
