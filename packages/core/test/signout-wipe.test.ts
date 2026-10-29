import { describe, expect, it } from "vitest";
import { Collection, MemoryStorage, wipeJourneys, wipeMentors } from "../src/index.js";

/** What a shared phone keeps after one owner signs out: public guides only, nothing personal. */
describe("sign-out wipes mentor records and moves", () => {
  it("leaves nothing of the owner's mentor answers, blocks, requests or moves, and keeps the public guide", async () => {
    const storage = new MemoryStorage();
    await storage.put(Collection.mentorSettings, "newcomer", { woman: true });
    await storage.put(Collection.mentorSettings, "choices", { slots: 2 });
    await storage.put(Collection.blocked, "u-blocked", { user: "u-blocked", at: "2026-10-29T00:00:00Z" });
    for (const c of [Collection.mentorRequests, Collection.mentorAsks, Collection.mentorIntros, Collection.mentorEarly])
      await storage.put(c, "ch-1", { channel: "ch-1" });
    await storage.put(Collection.journeys, "move-1", { id: "move-1" });
    await storage.put(Collection.guides, "bengaluru", { at: "2026-10-29T00:00:00Z" });

    await Promise.all([wipeMentors(storage), wipeJourneys(storage)]);

    for (const c of [
      Collection.mentorSettings,
      Collection.blocked,
      Collection.mentorRequests,
      Collection.mentorAsks,
      Collection.mentorIntros,
      Collection.mentorEarly,
      Collection.journeys,
    ])
      expect(await storage.list(c)).toEqual([]);
    expect(await storage.list(Collection.guides)).toHaveLength(1);
  });
});
