import { EVERY_DAY } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import {
  answerSchedule,
  CardKind,
  dueReminders,
  listBookings,
  localNow,
  MemoryStorage,
  overlaps,
  removeBooking,
  saveBooking,
  spanOf,
} from "../src/index.js";
import { Collection as Store } from "../src/ports.js";

/** Tuesday 3 November 2026, 10:00 in India (UTC+5:30). */
const AT = new Date("2026-11-03T04:30:00Z");
const NOW = localNow(AT, 330);
const TOMORROW = "2026-11-04";

async function ask(storage: MemoryStorage, text: string) {
  const card = await answerSchedule(text, storage, AT, NOW);
  if (card.kind !== CardKind.schedule) throw new Error(`expected a schedule card, got ${card.kind}`);
  return card;
}

describe("the phone's day and minute", () => {
  it("reads the local day and time from UTC and the offset", () => {
    expect(NOW).toEqual({ day: "2026-11-03", minute: 600 });
    expect(localNow(new Date("2026-11-03T20:00:00Z"), 330)).toEqual({ day: "2026-11-04", minute: 90 });
  });
});

describe("a worker's schedule by chat", () => {
  it("saves, lists and cancels a booking, in the owner's words", async () => {
    const storage = new MemoryStorage();
    const saved = await ask(storage, "save my booking for tomorrow 2-3PM at Sharma ji's house");
    expect(saved.say.key).toBe("schedule.saved");
    expect(saved.bookings).toMatchObject([{ day: TOMORROW, start_min: 840, end_min: 900, note: "Sharma ji's house" }]);

    const listed = await ask(storage, "what's on my schedule tomorrow?");
    expect(listed.say.key).toBe("schedule.list");
    expect(listed.bookings.map((b) => b.id)).toEqual(saved.bookings.map((b) => b.id));
    expect((await ask(storage, "मेरी परसों की बुकिंग क्या है")).say.key).toBe("schedule.free_day");

    const cancelled = await ask(storage, "cancel my booking tomorrow 2pm");
    expect(cancelled.say.key).toBe("schedule.cancelled");
    expect(await listBookings(storage)).toEqual([]);
    expect((await ask(storage, "what's on my schedule?")).say.key).toBe("schedule.empty");
  });

  it("says when a new booking overlaps one already kept, and keeps it anyway", async () => {
    const storage = new MemoryStorage();
    await ask(storage, "kal 2 se 3 baje booking hai");
    const second = await ask(storage, "ನಾಳೆ ಮಧ್ಯಾಹ್ನ 2:30 ರಿಂದ 4 ಗಂಟೆ ಬುಕಿಂಗ್ ಉಳಿಸಿ");
    expect(second.say.key).toBe("schedule.saved_clash");
    expect(second.bookings).toHaveLength(2);
    expect(await listBookings(storage)).toHaveLength(2);
  });

  it("asks which one when a cancel fits several, and cancels none", async () => {
    const storage = new MemoryStorage();
    await ask(storage, "booking tomorrow 9 to 10 am");
    await ask(storage, "booking tomorrow 4 to 5 pm");
    expect((await ask(storage, "cancel tomorrow's booking")).say.key).toBe("schedule.which");
    expect(await listBookings(storage)).toHaveLength(2);
    expect((await ask(storage, "cancel the booking tomorrow at 4 pm")).say.key).toBe("schedule.cancelled");
    expect((await ask(storage, "cancel the booking on Friday")).say.key).toBe("schedule.none_to_cancel");
  });
});

describe("the bookings on the phone", () => {
  it("skips a record that does not parse and drops past bookings as new ones come", async () => {
    const storage = new MemoryStorage();
    await storage.put(Store.bookings, "bkg_broken", { day: "tomorrow" });
    const old = await saveBooking(storage, { day: "2026-11-01", start_min: 600, end_min: 660 }, AT, NOW);
    expect((await listBookings(storage)).map((b) => b.id)).toEqual([old.id]);
    await saveBooking(storage, { day: TOMORROW, start_min: 600, end_min: 660 }, AT, NOW);
    expect((await listBookings(storage)).map((b) => b.day)).toEqual([TOMORROW]);
  });

  it("refuses a booking that ends before it starts", async () => {
    await expect(
      saveBooking(new MemoryStorage(), { day: TOMORROW, start_min: 900, end_min: 840 }, AT, NOW),
    ).rejects.toThrow();
  });

  it("removes only a booking id", async () => {
    const storage = new MemoryStorage();
    await storage.put(Store.contacts, "c1", { name: "x" });
    await removeBooking(storage, "c1");
    expect(await storage.list(Store.contacts)).toHaveLength(1);
  });
});

describe("what bookings rule out and when they are reminded", () => {
  it("clashes with a job by the minutes both take: its start hour and length, or its part of the day", () => {
    const booking = { day: TOMORROW, start_min: 690, end_min: 750 };
    expect(overlaps(booking, spanOf({ day: TOMORROW, window: "morning" }))).toBe(true);
    expect(overlaps(booking, spanOf({ day: TOMORROW, window: "afternoon" }))).toBe(true);
    expect(overlaps(booking, spanOf({ day: TOMORROW, window: "afternoon", hour: 13 }))).toBe(false);
    expect(overlaps(booking, spanOf({ day: TOMORROW, window: "morning", hour: 10 }))).toBe(true);
    expect(overlaps(booking, spanOf({ day: TOMORROW, window: "morning", hour: 9 }, 1))).toBe(false);
    expect(
      overlaps({ day: EVERY_DAY, start_min: 1020, end_min: 1080 }, spanOf({ day: TOMORROW, window: "evening" })),
    ).toBe(true);
  });

  it("reminds a booking within half an hour of its start, daily work each day", async () => {
    const storage = new MemoryStorage();
    const soon = await saveBooking(storage, { day: NOW.day, start_min: 620, end_min: 680 }, AT, NOW);
    await saveBooking(storage, { day: NOW.day, start_min: 700, end_min: 760 }, AT, NOW);
    const daily = await saveBooking(storage, { day: EVERY_DAY, start_min: 615, end_min: 640 }, AT, NOW);
    const due = dueReminders(await listBookings(storage), NOW);
    expect(due.map((r) => [r.booking.id, r.in_min])).toEqual([
      [daily.id, 15],
      [soon.id, 20],
    ]);
    expect(due[0]?.key).toBe(`${daily.id}:${NOW.day}`);
  });
});
