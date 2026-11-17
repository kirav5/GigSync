import { type EngagementStatus, MAX_REQUESTS_PER_DAY } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { askRefusal, type JobRecord, MAX_OPEN_REQUESTS, openRequests, requestsToday } from "../src/index.js";

/** Three needs going at once and twenty workers a day for a household (agreed 2026-11-18). */

const NOW = new Date("2026-11-18T10:00:00.000Z");
const HOUR = 3_600_000;

let n = 0;
/** A household's request in `group`, made `hoursAgo` before NOW, at `status`. */
function asked(group: string, status: EngagementStatus, hoursAgo = 1, role = "requester"): JobRecord {
  n += 1;
  const at = new Date(NOW.getTime() - hoursAgo * HOUR).toISOString();
  return { engagement: { id: `eng_${n}`, group, role, status, created_at: at } } as unknown as JobRecord;
}

describe("a household's open requests", () => {
  it("counts each need once, however many workers it asked, while its assistants still talk", () => {
    const jobs = [
      asked("g1", "negotiating"),
      asked("g1", "sent"),
      asked("g1", "declined"),
      asked("g2", "confirming"),
      asked("g3", "agreed"),
      asked("g4", "cancelled"),
      asked("g5", "negotiating", 1, "provider"),
    ];
    expect(openRequests(jobs)).toBe(2);
  });

  it("refuses a fourth need while three are going, and says so", () => {
    const three = ["g1", "g2", "g3"].map((g) => asked(g, "negotiating"));
    expect(MAX_OPEN_REQUESTS).toBe(3);
    expect(askRefusal(three, 1, NOW)).toBe("need.limit_open");
    expect(askRefusal(three.slice(0, 2), 3, NOW)).toBeUndefined();
  });

  it("refuses workers past the day's twenty, counting only the last 24 hours", () => {
    const today = Array.from({ length: MAX_REQUESTS_PER_DAY - 2 }, (_, i) => asked(`d${i}`, "agreed", 2));
    const yesterday = Array.from({ length: 10 }, (_, i) => asked(`y${i}`, "closed", 30));
    const jobs = [...today, ...yesterday];
    expect(requestsToday(jobs, NOW)).toBe(MAX_REQUESTS_PER_DAY - 2);
    expect(askRefusal(jobs, 2, NOW)).toBeUndefined();
    expect(askRefusal(jobs, 3, NOW)).toBe("need.limit_day");
  });
});
