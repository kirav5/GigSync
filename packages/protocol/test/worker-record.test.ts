import { describe, expect, it } from "vitest";
import { BoardProfile, MAX_RECORD_COUNT, roundAverage, WorkerRecord } from "../src/index.js";

const area = { lat: 12.97, lon: 77.64 };
const profile = { display_name: "Ravi", trades: ["electrician"], area, area_name: "Indiranagar", rate_paise: 50000 };
const record = { jobs: 12, rated: 7, average: 4.6, came_back: 3 };

describe("worker record", () => {
  it("is optional on a card, with the choice to show it", () => {
    expect(BoardProfile.parse(profile).record).toBeUndefined();
    expect(BoardProfile.parse({ ...profile, record, show_record: false })).toMatchObject({
      record,
      show_record: false,
    });
  });
  it("leaves the average out until it is known", () => {
    expect(WorkerRecord.safeParse({ jobs: 1, rated: 0, came_back: 0 }).success).toBe(true);
  });
  it("refuses negative, fractional or huge counts and stars outside one to five", () => {
    expect(WorkerRecord.safeParse({ ...record, jobs: -1 }).success).toBe(false);
    expect(WorkerRecord.safeParse({ ...record, rated: 1.5 }).success).toBe(false);
    expect(WorkerRecord.safeParse({ ...record, came_back: MAX_RECORD_COUNT + 1 }).success).toBe(false);
    expect(WorkerRecord.safeParse({ ...record, average: 0.9 }).success).toBe(false);
    expect(WorkerRecord.safeParse({ ...record, average: 5.1 }).success).toBe(false);
  });
  it("rounds an average to one decimal", () => {
    expect(roundAverage(4.649)).toBe(4.6);
    expect(roundAverage(13 / 3)).toBe(4.3);
  });
});
