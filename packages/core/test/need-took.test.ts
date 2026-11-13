import { Arrangement, type Lang, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  CITY_RATES,
  chooseNeed,
  hearNeed,
  type Line,
  NeedSlot,
  type NeedState,
  needPrompt,
  startNeed,
} from "../src/index.js";

/** Find's small print after a later answer in words: what that answer gave the need ("Understood: 2 bedrooms, …"). */

const config = (own: Lang = "en") => ({
  own,
  areas: [{ key: "nandini_layout", names: ["Nandini Layout"] }],
  rates: CITY_RATES,
  today: "2026-11-13",
});
const CLEAN = "i want someone to come clean my house tomorrow";
const ROOMS = "2 rooms and we need someone to mop the floors and do dishes";
const aside = (s: NeedState): Line[] => needPrompt(s).lines.filter((l) => l.aside);
const said = (s: NeedState) => aside(s).map((l) => l.params?.what);
/** The household's first message, read as a maid's work for tomorrow, as the phone's reader reads it. */
const named = (own: Lang = "en") =>
  hearNeed(startNeed(config(own)), CLEAN, false, { trade: Trade.enum.maid, decided: true });

describe("what a later answer gave", () => {
  it("is read back over each next question, as the first answer's work is", () => {
    const rooms = hearNeed(named(), ROOMS);
    expect(rooms.slot).toBe(NeedSlot.arrangement);
    expect(aside(rooms)).toEqual([
      { key: "need.understood", params: { what: "2 bedrooms, with dishes" }, silent: true, aside: true },
    ]);
    const hours = hearNeed(rooms, "one hour just for tomorrow");
    expect(hours.slot).toBe(NeedSlot.area);
    expect(hours.draft.arrangement).toBe(Arrangement.enum.hourly);
    expect(said(hours)).toEqual(["By the hour"]);
    const area = hearNeed(hours, "Nandini Layout");
    expect(said(area)).toEqual(["Nandini Layout"]);
    expect(said(hearNeed(area, "10 am"))).toEqual(["10 am"]);
  });

  it("names a day the answer changed, and not one already said", () => {
    const rooms = hearNeed(named(), ROOMS);
    // Tomorrow was said in the first message: "just for tomorrow" changes nothing, so only the hours are named.
    expect(said(hearNeed(rooms, "one hour just for tomorrow"))).toEqual(["By the hour"]);
  });

  it("is not said for a tap, which shows its own answer, or for an answer not understood", () => {
    const rooms = hearNeed(named(), ROOMS);
    expect(aside(chooseNeed(rooms, Arrangement.enum.hourly))).toEqual([]);
    const again = hearNeed(rooms, "hmm");
    expect(again.slot).toBe(NeedSlot.arrangement);
    expect(aside(again)).toEqual([]);
  });

  it("is never read aloud, and the work's own note is not repeated", () => {
    const rooms = hearNeed(named(), ROOMS);
    expect(aside(rooms).every((l) => l.silent)).toBe(true);
    expect(aside(rooms).map((l) => l.names)).toEqual([undefined]);
  });

  it("is in the owner's language", () => {
    const rooms = hearNeed(named("hi"), "2 कमरे, झाड़ू पोछा और बर्तन");
    expect(said(rooms)).toEqual(["2 बेडरूम, बर्तन के साथ"]);
  });
});
