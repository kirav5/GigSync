import { HttpMethod } from "@gigsync/core";
import type { BoardProfileInput, BoardSkills, Skill, Trade } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/** Hampi, so these workers never meet the ones other test files list. */
const HERE = { lat: 15.33, lon: 76.46 };
const north = (km: number) => ({ lat: HERE.lat + km / 111, lon: HERE.lon });

const card = (name: string, skills: Skill[], km: number, trades: Trade[] = []): BoardProfileInput => ({
  display_name: name,
  trades,
  skills,
  area: north(km),
  area_name: "Hampi",
  rate_paise: 50000,
  languages: ["kn"],
});

const skill = (text: string, lang: Skill["lang"] = "en"): Skill => ({ text, lang });

describe("skills on the board (ADR 0047)", () => {
  it("lists a card with only the worker's own skills and finds it by the skill's key", async () => {
    const w = await signIn("+919822200001");
    await w.api.publishProfile(card("Lakshmi", [skill("Saree Pleating")], 1));
    await (await signIn("+919822200002")).api.publishProfile(card("Ganesh", [skill("saree pleating ")], 3, ["cook"]));
    const household = await signIn("+919822200003");

    const found = await household.api.searchWorkers({ skill: "saree pleating", ...HERE, radius_km: 5 });
    expect(found.map((x) => x.display_name)).toEqual(["Lakshmi", "Ganesh"]);
    expect(found[0]?.skills).toEqual([skill("Saree Pleating")]);
    expect(found[0]?.trades).toEqual([]);
    // A trade search is as before: only the cook, and a skill-only card never appears in it.
    const cooks = (await household.api.searchWorkers({ trade: "cook", ...HERE })).map((x) => x.display_name);
    expect(cooks).toContain("Ganesh");
    expect(cooks).not.toContain("Lakshmi");
  });

  it("serves the skill list with one entry per key and how many list it", async () => {
    await (await signIn("+919822200004")).api.publishProfile(card("Ravi", [skill("Kite Repair")], 1));
    await (await signIn("+919822200005")).api.publishProfile(card("Rani", [skill("KITE repair")], 2));
    const res = await call(await signIn("+919822200006"), HttpMethod.get, "/board/skills");
    expect(res.status).toBe(200);
    const { skills } = (await res.json()) as BoardSkills;
    const kite = skills.filter((s) => s.key === "kite repair");
    expect(kite).toHaveLength(1);
    expect(kite[0]?.workers).toBe(2);
  });

  it("drops a card's skills when it is republished without them, and on unlist", async () => {
    const w = await signIn("+919822200007");
    await w.api.publishProfile(card("Meena", [skill("Pot Painting")], 1));
    await w.api.publishProfile(card("Meena", [], 1, ["maid"]));
    expect(await w.api.searchWorkers({ skill: "pot painting", ...HERE })).toEqual([]);
    await w.api.publishProfile(card("Meena", [skill("Pot Painting")], 1));
    await w.api.removeProfile();
    expect(await w.api.searchWorkers({ skill: "pot painting", ...HERE })).toEqual([]);
  });

  it("refuses a skill the board may not list, a card with no work, and a search by words", async () => {
    const w = await signIn("+919822200008");
    for (const bad of [skill("Call 98450 12345"), skill("escort service"), skill("I stitch blouses for all ladies")])
      await expect(w.api.publishProfile(card("X", [bad], 1))).rejects.toMatchObject({ status: 400 });
    await expect(w.api.publishProfile(card("X", [], 1))).rejects.toMatchObject({ status: 400 });
    const words = await call(w, HttpMethod.get, "/board/workers?skill=I%20need%20a%20Tailor!&lat=15.33&lon=76.46");
    expect(words.status).toBe(400);
  });

  it("needs a session for the skill list", async () => {
    expect((await call(undefined, HttpMethod.get, "/board/skills")).status).toBe(401);
  });
});
