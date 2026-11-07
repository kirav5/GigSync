import { HttpMethod } from "@gigsync/core";
import type { BoardProfileInput, BoardResult, BoardSkills, ListedRates, Skill, Trade } from "@gigsync/protocol";
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

describe("kinds of work (ADR 0059)", () => {
  /** Vijayapura, away from every other test file's workers. */
  const THERE = { lat: 16.83, lon: 75.71 };
  const near = `lat=${THERE.lat}&lon=${THERE.lon}&radius_km=5`;
  const worker = (name: string, skills: Skill[]): BoardProfileInput => ({
    display_name: name,
    trades: [],
    skills,
    area: THERE,
    area_name: "Vijayapura",
    rate_paise: 40000,
    languages: ["en"],
  });
  const tv = (text: string): Skill => ({ text, lang: "en", category: "tv_repair" });
  const names = async (viewer: Awaited<ReturnType<typeof signIn>>, query: string) => {
    const res = await call(viewer, HttpMethod.get, `/board/workers?${query}&${near}`);
    const { workers } = (await res.json()) as BoardResult;
    return workers.map((w) => w.display_name).sort();
  };

  it("finds every wording together, one worker once, and keeps each worker's own words", async () => {
    await (await signIn("+919822400001")).api.publishProfile(worker("Ravi", [tv("TV mechanic")]));
    await (await signIn("+919822400002")).api.publishProfile(worker("Sunil", [tv("टीवी ठीक करना"), tv("TV man")]));
    await (await signIn("+919822400003")).api.publishProfile(worker("Meena", [{ text: "Quilt making", lang: "en" }]));
    const viewer = await signIn("+919822400004");
    expect(await names(viewer, "category=tv_repair")).toEqual(["Ravi", "Sunil"]);
    expect(await names(viewer, "skill=quilt%20making")).toEqual(["Meena"]);
    const res = await call(viewer, HttpMethod.get, `/board/workers?category=tv_repair&${near}`);
    const { workers } = (await res.json()) as BoardResult;
    expect(workers.find((w) => w.display_name === "Ravi")?.skills).toEqual([tv("TV mechanic")]);
    expect(workers.find((w) => w.display_name === "Sunil")?.skills).toHaveLength(2);
  });

  it("names the kind on the skill list, and none on a skill with no kind", async () => {
    const viewer = await signIn("+919822400005");
    const res = await call(viewer, HttpMethod.get, "/board/skills");
    const { skills } = (await res.json()) as BoardSkills;
    expect(skills.find((s) => s.key === "tv mechanic")?.category).toBe("tv_repair");
    const quilt = skills.find((s) => s.key === "quilt making");
    expect(quilt).toBeDefined();
    expect(quilt).not.toHaveProperty("category");
  });

  it("keeps a kind set here when a phone sends its older copy of the card", async () => {
    const owner = await signIn("+919822400006");
    await owner.api.publishProfile(worker("Kumar", [tv("Television repair")]));
    await owner.api.publishProfile(worker("Kumar", [{ text: "Television repair", lang: "en" }]));
    expect(await names(owner, "category=tv_repair")).toContain("Kumar");
  });

  it("counts a worker once towards the rates, whatever wordings they list", async () => {
    const viewer = await signIn("+919822400007");
    const res = await call(viewer, HttpMethod.get, `/board/rates?category=tv_repair&${near}`);
    expect((await res.json()) as ListedRates).toEqual({
      workers: 3,
      low_paise: 40000,
      high_paise: 40000,
    });
  });

  it("refuses a kind that is not on the list, or two ways of searching at once", async () => {
    const viewer = await signIn("+919822400008");
    const search = (query: string) => call(viewer, HttpMethod.get, `/board/workers?${query}&${near}`);
    expect((await search("category=rocket_repair")).status).toBe(400);
    expect((await search("category=tv_repair&trade=plumber")).status).toBe(400);
    const rates = await call(viewer, HttpMethod.get, `/board/rates?category=tv_repair&skill=tv%20man&${near}`);
    expect(rates.status).toBe(400);
  });
});
