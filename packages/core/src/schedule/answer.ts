import { type Booking, EVERY_DAY, type Terms, type TermWhen } from "@gigsync/protocol";
import { type Card, CardKind } from "../experts.js";
import type { MessageKey } from "../i18n/t.js";
import type { JobRecord } from "../job/store.js";
import { bookedTerms, bookedTimes } from "../job/taken.js";
import { log } from "../log.js";
import { Collection, type Storage } from "../ports.js";
import { readSchedule, ScheduleAction, type ScheduleAsk } from "./read.js";
import { isOn, listBookings, type NewBooking, removeBooking, saveBooking, upcoming } from "./store.js";
import { type Hours, type LocalNow, overlaps, spanOf } from "./windows.js";

/**
 * The agent's answer to a message about the worker's schedule (ADR 0048): keep a booking, list what is coming, or take
 * one off. The words were read by code (`readSchedule`); the card carries the bookings and signed jobs themselves, so
 * the phone writes their days and times in whatever language the owner reads later.
 */

const schedule = (key: MessageKey, bookings: Booking[] = [], jobs: TermWhen[] = []): Card => ({
  kind: CardKind.schedule,
  say: { key },
  bookings,
  jobs,
});

/**
 * What a new booking runs into: other bookings by their minutes; signed jobs from their start hour for their own hours
 * a day, or by their part of the day.
 */
function clashesWith(booking: Hours, bookings: readonly Booking[], jobs: readonly (Terms & { when: TermWhen })[]) {
  return {
    bookings: bookings.filter((b) => overlaps(booking, b)),
    jobs: jobs.filter((j) => overlaps(booking, spanOf(j.when, j.hours))).map((j) => j.when),
  };
}

/** Signed jobs still to come, on `day` when one was said. */
const jobsAhead = (jobs: readonly TermWhen[], now: LocalNow, day?: string) =>
  jobs.filter((j) => (j.day === EVERY_DAY || j.day >= now.day) && (!day || j.day === day || j.day === EVERY_DAY));

/** Keeps the booking, saying so and naming what it runs into; a save always has a day and hours (`readSchedule`). */
async function save(storage: Storage, ask: ScheduleAsk, at: Date, now: LocalNow): Promise<Card> {
  const { day, start_min, end_min, note } = ask;
  if (!day || start_min === undefined || end_min === undefined) return list(storage, ask, now);
  const booking: NewBooking = { day, start_min, end_min, ...(note ? { note } : {}) };
  const [all, jobs] = await Promise.all([listBookings(storage), signedTerms(storage)]);
  const clash = clashesWith(booking, all, jobs);
  const saved = await saveBooking(storage, booking, at, now);
  const any = clash.bookings.length + clash.jobs.length > 0;
  return schedule(any ? "schedule.saved_clash" : "schedule.saved", [saved, ...clash.bookings], clash.jobs);
}

/** What is coming, on the day said or from now on, with the signed jobs beside the bookings. */
async function list(storage: Storage, ask: ScheduleAsk, now: LocalNow): Promise<Card> {
  const bookings = upcoming(await listBookings(storage), now).filter((b) => !ask.day || isOn(b, ask.day));
  const jobs = jobsAhead(await signedJobs(storage), now, ask.day);
  if (bookings.length + jobs.length > 0) return schedule("schedule.list", bookings, jobs);
  return schedule(ask.day ? "schedule.free_day" : "schedule.empty");
}

/** Takes off the one booking the words point at; several that fit are listed so the owner can say which. */
async function cancel(storage: Storage, ask: ScheduleAsk, now: LocalNow): Promise<Card> {
  const { day, start_min, end_min } = ask;
  const fits = upcoming(await listBookings(storage), now).filter(
    (b) =>
      (!day || isOn(b, day)) &&
      (start_min === undefined || end_min === undefined || overlaps(b, { day: b.day, start_min, end_min })),
  );
  const [only] = fits;
  if (!only) return schedule("schedule.none_to_cancel");
  if (fits.length > 1) return schedule("schedule.which", fits);
  await removeBooking(storage, only.id);
  return schedule("schedule.cancelled", [only]);
}

/** The times both sides signed for, from this owner's jobs. */
async function signedJobs(storage: Storage): Promise<TermWhen[]> {
  return bookedTimes(await storage.list<JobRecord>(Collection.jobs));
}

/** The terms both sides signed that set a time: with each job's own hours a day. */
async function signedTerms(storage: Storage) {
  return bookedTerms(await storage.list<JobRecord>(Collection.jobs));
}

/** One message about the schedule in, one card out; `now` is the phone's own day and minute at `at`. */
export async function answerSchedule(text: string, storage: Storage, at: Date, now: LocalNow): Promise<Card> {
  const ask = readSchedule(text, now);
  log.debug("schedule: read", { action: ask.action, day: ask.day !== undefined, time: ask.start_min !== undefined });
  switch (ask.action) {
    case ScheduleAction.save:
      return save(storage, ask, at, now);
    case ScheduleAction.cancel:
      return cancel(storage, ask, now);
    case ScheduleAction.list:
      return list(storage, ask, now);
  }
}
