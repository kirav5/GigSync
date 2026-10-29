import { type MentorListingInput, MentorRole } from "@gigsync/protocol";
import { apiOf, type MentorContext } from "./context.js";
import { type MentorRecord, mentorRecord } from "./eligibility.js";
import { MentorError, MentorRefusal } from "./errors.js";
import { sweepExpired } from "./link.js";
import type { MentorChoices } from "./types.js";

/** What the owner chooses in Profile; whether they are listed follows from publishing or not. */
export type ListingChoices = Omit<MentorChoices, "listed" | "vouched_by">;

/** This phone's own count of finished jobs both sides signed, and whether it reaches the minimum. */
export async function myRecord(m: MentorContext): Promise<MentorRecord> {
  return mentorRecord(await m.ctx.store.jobs(), m.ctx.clock.now());
}

/** Newcomers this owner is helping now: live mentor links where this phone is the mentor's. */
async function helping(m: MentorContext): Promise<number> {
  const live = await sweepExpired(m.links, m.ctx.clock.now());
  return live.filter((l) => l.mentor?.role === MentorRole.enum.mentor).length;
}

/**
 * The listing the server keeps, from the owner's choices and this phone's record. "Only women newcomers" counts only
 * for a mentor who said she is a woman, so a listing never hides from women for any other reason.
 */
export function listingOf(choices: ListingChoices, record: MentorRecord, busy: number): MentorListingInput {
  return {
    first_name: choices.first_name,
    city: choices.city,
    area: choices.area,
    trades: choices.trades,
    languages: choices.languages,
    months: record.months,
    jobs: record.jobs,
    open_slots: Math.max(0, choices.slots - busy),
    woman: choices.woman,
    women_only_newcomers: choices.woman && choices.women_only_newcomers,
    active: true,
  };
}

/** Lists the owner as a mentor, once their own record reaches the minimum; keeps their choices and any badge. */
export async function publish(m: MentorContext, choices: ListingChoices): Promise<MentorChoices> {
  const record = await myRecord(m);
  if (!record.eligible) throw new MentorError(MentorRefusal.notEligible);
  const { listing } = await apiOf(m).publishMentor(listingOf(choices, record, await helping(m)));
  const saved: MentorChoices = { ...choices, listed: true, vouched_by: listing.vouched_by };
  await m.store.saveChoices(saved);
  return saved;
}

/** Takes the owner off the mentor list; their choices stay on this phone for next time. */
export async function unpublish(m: MentorContext): Promise<void> {
  await apiOf(m).removeMentor();
  const choices = await m.store.choices();
  if (choices) await m.store.saveChoices({ ...choices, listed: false });
}

/** After a mentor link opens or ends: the listing's open slots follow how many newcomers the owner is helping. */
export async function refreshSlots(m: MentorContext): Promise<void> {
  const choices = await m.store.choices();
  if (!choices?.listed || !m.api) return;
  const record = await myRecord(m);
  if (!record.eligible) return;
  await m.api.publishMentor(listingOf(choices, record, await helping(m)));
}
