import { JourneyStep } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  advanceStep,
  autoTick,
  checklist,
  FIRST_JOB_ITEM,
  FixedItem,
  fixedItem,
  ItemKind,
  type Journey,
  StartProblem,
  sectionItem,
  startJourney,
  stepBack,
  stepProgress,
  TickBy,
  toggleItem,
} from "../src/index.js";
import { BENGALURU, KORAMANGALA, MYSURU, OWNER, signedJob } from "./landing-fixtures.js";

const S = JourneyStep.enum;
const NOW = new Date("2026-10-29T10:00:00+05:30");
const START = { id: "move_1", owner: OWNER, city: "bengaluru", arrival: "2026-11-16", trade: "maid", now: NOW };

function started(): Journey {
  const journey = startJourney(START);
  if (typeof journey === "string") throw new Error(`not started: ${journey}`);
  return journey;
}

describe("starting a move", () => {
  it("starts at planning with nothing ticked", () => {
    const journey = started();
    expect(journey.step).toBe(S.planning);
    expect(journey.ticked).toEqual({});
    expect(journey.started_at).toBe(NOW.toISOString());
  });

  it("refuses a city without a guide, a day that is not a day, and an unknown trade", () => {
    expect(startJourney({ ...START, city: "chennai" })).toBe(StartProblem.city);
    expect(startJourney({ ...START, arrival: "2026-02-30" })).toBe(StartProblem.arrival);
    expect(startJourney({ ...START, arrival: "16/11/2026" })).toBe(StartProblem.arrival);
    expect(startJourney({ ...START, trade: "astronaut" })).toBe(StartProblem.trade);
  });
});

describe("the steps", () => {
  it("go forward in order only when the owner moves on, and stop at settled", () => {
    let journey = started();
    const seen = [journey.step];
    for (let i = 0; i < JourneyStep.options.length + 2; i++) {
      journey = advanceStep(journey);
      if (journey.step !== seen.at(-1)) seen.push(journey.step);
    }
    expect(seen).toEqual(JourneyStep.options);
    expect(advanceStep(journey).step).toBe(S.settled);
  });

  it("go back one at a time and stop at planning", () => {
    const arrived = advanceStep(advanceStep(started()));
    expect(arrived.step).toBe(S.arrived);
    expect(stepBack(arrived).step).toBe(S.travelling);
    expect(stepBack(stepBack(stepBack(arrived))).step).toBe(S.planning);
  });

  it("keep what was ticked when the step changes", () => {
    const ticked = toggleItem(started(), fixedItem(FixedItem.money));
    expect(advanceStep(ticked).ticked).toEqual({ [fixedItem(FixedItem.money)]: TickBy.owner });
  });
});

describe("each step's checklist", () => {
  it("is the guide's sections for that step in the guide's order, then the fixed items", () => {
    const arrived = checklist(BENGALURU, S.arrived);
    const sections = BENGALURU.sections.filter((s) => s.step === S.arrived).map((s) => sectionItem(s.id));
    expect(arrived.map((i) => i.id)).toEqual([...sections, fixedItem(FixedItem.save_address)]);
    expect(sections).toContain(sectionItem("first-nights-women-hostels"));
    expect(arrived[0]?.kind).toBe(ItemKind.section);
  });

  it("has items at every step, even where the guide has no section", () => {
    for (const step of JourneyStep.options) expect(checklist(BENGALURU, step).length).toBeGreaterThan(0);
    expect(checklist(BENGALURU, S.housed).every((i) => i.kind === ItemKind.fixed)).toBe(true);
  });

  it("counts what is ticked", () => {
    const journey = toggleItem(started(), fixedItem(FixedItem.money));
    expect(stepProgress(BENGALURU, S.planning, journey.ticked)).toEqual({ done: 1, total: 3 });
  });

  it("ticks and unticks by the owner", () => {
    const item = sectionItem("sim-card");
    const ticked = toggleItem(started(), item);
    expect(ticked.ticked[item]).toBe(TickBy.owner);
    expect(toggleItem(ticked, item).ticked[item]).toBeUndefined();
  });
});

describe("the app's own tick", () => {
  it("ticks the first job once a job both signed in the city is on the phone", () => {
    const journey = autoTick(started(), [signedJob(KORAMANGALA)]);
    expect(journey.ticked[FIRST_JOB_ITEM]).toBe(TickBy.app);
    // It never moves a step: that is the owner's choice.
    expect(journey.step).toBe(S.planning);
  });

  it("leaves it for a job signed by one side only, a job elsewhere, or a job this phone asked for", () => {
    const jobs = [
      signedJob(KORAMANGALA, { theirs: false }),
      signedJob(MYSURU),
      signedJob(KORAMANGALA, { role: "requester" }),
    ];
    expect(autoTick(started(), jobs).ticked[FIRST_JOB_ITEM]).toBeUndefined();
  });

  it("does not tick again what the owner unticked", () => {
    const ticked = autoTick(started(), [signedJob(KORAMANGALA)]);
    const cleared = toggleItem(ticked, FIRST_JOB_ITEM);
    expect(cleared.cleared).toEqual([FIRST_JOB_ITEM]);
    expect(autoTick(cleared, [signedJob(KORAMANGALA)]).ticked[FIRST_JOB_ITEM]).toBeUndefined();
    // Ticking it by hand again is still the owner's to do.
    expect(toggleItem(cleared, FIRST_JOB_ITEM).ticked[FIRST_JOB_ITEM]).toBe(TickBy.owner);
  });
});
