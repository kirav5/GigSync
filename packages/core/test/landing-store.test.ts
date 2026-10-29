import type { City, CityGuide } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  Collection,
  currentJourney,
  GUIDE_FRESH_MS,
  type Journey,
  loadGuide,
  MemoryStorage,
  NetError,
  NetReason,
  removeJourney,
  savedGuide,
  saveJourney,
} from "../src/index.js";
import { BENGALURU, OWNER } from "./landing-fixtures.js";

const NOW = new Date("2026-10-29T10:00:00Z");
const LATER = new Date(NOW.getTime() + GUIDE_FRESH_MS + 1);
const OTHER = "usr_01J0000000000000000000OOOO" as Journey["owner"];

/** A fake API: answers with the guide, or fails as a phone without a network does. */
function api(answer: CityGuide | NetError) {
  const calls: City[] = [];
  const fetch = async (city: City) => {
    calls.push(city);
    if (answer instanceof NetError) throw answer;
    return answer;
  };
  return { calls, fetch };
}

describe("the city guide on the phone", () => {
  it("downloads once, then opens from the phone while fresh", async () => {
    const storage = new MemoryStorage();
    const online = api(BENGALURU);
    expect((await loadGuide(storage, online.fetch, "bengaluru", NOW))?.offline).toBe(false);
    expect((await loadGuide(storage, online.fetch, "bengaluru", NOW))?.guide).toEqual(BENGALURU);
    expect(online.calls).toEqual(["bengaluru"]);
  });

  it("opens offline from the copy kept on the phone once it was downloaded", async () => {
    const storage = new MemoryStorage();
    await loadGuide(storage, api(BENGALURU).fetch, "bengaluru", NOW);
    const offline = await loadGuide(storage, api(new NetError(NetReason.offline)).fetch, "bengaluru", LATER);
    expect(offline?.offline).toBe(true);
    expect(offline?.guide.sections.length).toBe(BENGALURU.sections.length);
    expect(offline?.at).toBe(NOW.toISOString());
    expect(await savedGuide(storage, "bengaluru")).toEqual(BENGALURU);
  });

  it("has nothing to show offline before the first download", async () => {
    const offline = api(new NetError(NetReason.offline));
    expect(await loadGuide(new MemoryStorage(), offline.fetch, "bengaluru", NOW)).toBeUndefined();
    expect(await savedGuide(new MemoryStorage(), "bengaluru")).toBeUndefined();
  });

  it("downloads again when a kept copy no longer fits the schema", async () => {
    const storage = new MemoryStorage();
    await storage.put(Collection.guides, "bengaluru", { guide: { city: "bengaluru" }, at: NOW.toISOString() });
    const online = api(BENGALURU);
    expect((await loadGuide(storage, online.fetch, "bengaluru", NOW))?.guide).toEqual(BENGALURU);
    expect(online.calls).toHaveLength(1);
  });
});

describe("moves on the phone", () => {
  const move = (id: string, owner: Journey["owner"], started_at: string): Journey => ({
    id,
    owner,
    city: "bengaluru",
    arrival: "2026-11-16",
    trade: "maid",
    step: "planning",
    ticked: {},
    cleared: [],
    started_at,
  });

  it("the current move is the owner's newest; another owner's is never shown", async () => {
    const storage = new MemoryStorage();
    await saveJourney(storage, move("a", OWNER, "2026-10-01T00:00:00Z"));
    await saveJourney(storage, move("b", OWNER, "2026-10-20T00:00:00Z"));
    await saveJourney(storage, move("c", OTHER, "2026-10-25T00:00:00Z"));
    expect((await currentJourney(storage, OWNER))?.id).toBe("b");
    await removeJourney(storage, move("b", OWNER, ""));
    expect((await currentJourney(storage, OWNER))?.id).toBe("a");
  });
});
