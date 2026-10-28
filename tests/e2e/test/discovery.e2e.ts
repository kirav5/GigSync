import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { near, newCentre, type Person, person, worker } from "./world.js";

const centre = newCentre();
const listed: Person[] = [];
let priya: Person;

beforeAll(async () => {
  const list = async (...a: Parameters<typeof worker>) => {
    const w = await worker(...a);
    listed.push(w);
    return w;
  };
  await list("Anil", ["electrician"], near(centre, 0.5), { rate: 70000, min: 55000 });
  await list("Babu", ["electrician", "ac_technician"], near(centre, 0, 2), { rate: 65000, min: 52000 });
  await list("Chetan", ["electrician"], near(centre, -8), { rate: 80000, min: 62000 });
  await list("Dinesh", ["electrician"], near(centre, 40), { rate: 50000, min: 40000 });
  await list("Esha", ["plumber"], near(centre, 1.5), { rate: 60000, min: 45000 });
  await list("Farid", ["plumber"], near(centre, 3), { rate: 55000, min: 42000 });
  await list("Gauri", ["maid"], near(centre, 0.5), { rate: 40000, min: 35000 });
  await list("Hema", ["maid", "cook"], near(centre, 2.5), { rate: 45000, min: 38000 });
  // The board rounds areas to about 1.1 km, so each stored point can move up to ~0.6 km. Workers whose order a test
  // asserts sit at least 1.2 km apart, or the rounding (which depends on the random centre) can swap them.
  await list("Imran", ["ac_technician"], near(centre, 3.5), { rate: 90000, min: 70000 });
  priya = await person("Priya", { address: "Flat 302, 3rd floor" });
});

afterAll(async () => {
  await Promise.all(listed.map((w) => w.api.removeProfile()));
});

const names = (ws: { display_name: string }[]) => ws.map((w) => w.display_name);

describe("a consumer discovers workers by need", () => {
  it("finds electricians within 5 km, nearest first, and nobody else", async () => {
    const found = await priya.api.searchWorkers({ trade: "electrician", ...centre, radius_km: 5 });
    expect(names(found)).toEqual(["Anil", "Babu"]);
    expect(found.map((w) => w.distance_km)).toEqual([...found.map((w) => w.distance_km)].sort((a, b) => a - b));
  });

  it("widening the radius brings in the next electrician but never the one 40 km away", async () => {
    const found = await priya.api.searchWorkers({ trade: "electrician", ...centre, radius_km: 10 });
    expect(names(found)).toEqual(["Anil", "Babu", "Chetan"]);
  });

  it("finds plumbers, maids and AC technicians for those needs", async () => {
    const [plumbers, maids, ac] = await Promise.all([
      priya.api.searchWorkers({ trade: "plumber", ...centre }),
      priya.api.searchWorkers({ trade: "maid", ...centre }),
      priya.api.searchWorkers({ trade: "ac_technician", ...centre }),
    ]);
    expect(names(plumbers)).toEqual(["Esha", "Farid"]);
    expect(names(maids)).toEqual(["Gauri", "Hema"]);
    // Babu does both electrical and AC work, so he shows up for either need.
    expect(names(ac)).toEqual(["Babu", "Imran"]);
  });

  it("returns nobody for a trade no one nearby offers", async () => {
    expect(await priya.api.searchWorkers({ trade: "painter", ...centre })).toEqual([]);
  });

  it("filters by the most the consumer wants to pay", async () => {
    const found = await priya.api.searchWorkers({
      trade: "electrician",
      ...centre,
      radius_km: 10,
      max_rate_paise: 70000,
    });
    expect(names(found)).toEqual(["Anil", "Babu"]);
  });

  it("shows public cards only: no phone numbers, areas rounded", async () => {
    const found = await priya.api.searchWorkers({ trade: "maid", ...centre });
    const text = JSON.stringify(found);
    for (const w of listed) expect(text).not.toContain(w.contact.phone.slice(3));
    for (const w of found) {
      expect(Math.round(w.area.lat * 100)).toBeCloseTo(w.area.lat * 100, 6);
    }
  });

  it("a worker who unlists disappears from search", async () => {
    const hema = listed.find((w) => w.name === "Hema") as Person;
    expect(await hema.api.removeProfile()).toBe(true);
    expect(names(await priya.api.searchWorkers({ trade: "maid", ...centre }))).toEqual(["Gauri"]);
    expect(await priya.api.searchWorkers({ trade: "cook", ...centre })).toEqual([]);
  });
});
