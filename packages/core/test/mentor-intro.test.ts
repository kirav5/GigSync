import {
  type ColleagueCard,
  type EngagementId,
  EnvelopeKind,
  LinkKind,
  MENTOR_LINK_TTL_MS,
  MentorReply,
  MentorRole,
} from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { MentorError, MentorRefusal, NoteFrom, settle } from "../src/index.js";
import { ASHA_N, ASHA_N_CARD, FakeMentorServer, MUKESH, MUKESH_CARD, mentorPhone, TestClock } from "./mentor-phones.js";
import { linkOf, seedJob, seedLink, seedPastLink, stranger } from "./mentor-seeds.js";
import { MemoryRelay, type Phone } from "./phones.js";

const SURESH = { name: "Suresh", phone: "+919800000111" };
const SURESH_CARD: ColleagueCard = { name: "Suresh", trades: ["electrician"], languages: ["hi"] };
const R = MentorReply.enum;
/** What Suresh's phone knows of each of them from a cooking job: their name and the trade. */
const AS_HIS_COOK = { trades: ["cook"], languages: [] };

async function threePhones() {
  const relay = new MemoryRelay();
  const server = new FakeMentorServer();
  const clock = new TestClock(new Date("2026-10-29T10:00:00+05:30"));
  const [suresh, asha, mukesh] = await Promise.all([
    mentorPhone(relay, server, SURESH, clock),
    mentorPhone(relay, server, ASHA_N, clock),
    mentorPhone(relay, server, MUKESH, clock),
  ]);
  return { relay, clock, suresh, asha, mukesh };
}

/** Suresh's household signed a job with Asha (moving to Bengaluru) and with Mukesh (who cooks there). */
async function throughJobs() {
  const w = await threePhones();
  const s = { phone: w.suresh, contact: SURESH };
  await seedJob(s, { phone: w.asha, contact: ASHA_N });
  await seedJob(s, { phone: w.mukesh, contact: MUKESH });
  return w;
}

const all = (...phones: Phone[]) => settle(phones.map((p) => p.device));

/** Both introduced people say yes, after the safety words. */
async function bothSayYes(asha: Phone, mukesh: Phone) {
  const [toAsha] = await asha.device.mentors.intros();
  const [toMukesh] = await mukesh.device.mentors.intros();
  await asha.device.mentors.safetySeen();
  await asha.device.mentors.answerIntro(toAsha?.channel ?? ("" as never), R.accept);
  await all(asha, mukesh);
  await mukesh.device.mentors.safetySeen();
  await mukesh.device.mentors.answerIntro(toMukesh?.channel ?? ("" as never), R.accept);
  await all(mukesh, asha);
  return toAsha?.channel;
}

describe("introductions through people you know", () => {
  it("through signed jobs: Asha asks Suresh, he introduces Mukesh, both say yes, and a mentor link opens", async () => {
    const { clock, suresh, asha, mukesh } = await throughJobs();
    await asha.device.mentors.askAround(suresh.user, "bengaluru");
    await all(asha, suresh);
    // Her ask lands with the job they signed, on his phone.
    const [job] = (await suresh.device.store.jobs()).filter((j) => j.engagement.counterpart === asha.user);
    expect(job?.notes?.[0]).toMatchObject({ lang: "en" });
    expect(job?.notes?.[0]?.text).toContain("Bengaluru");

    const people = await suresh.device.mentors.people();
    expect(people.map((p) => [p.card.name, p.worker])).toEqual([
      ["Asha", true],
      ["Mukesh", true],
    ]);
    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha, mukesh);
    const [toAsha] = await asha.device.mentors.intros();
    const [toMukesh] = await mukesh.device.mentors.intros();
    expect(toAsha).toMatchObject({ other: mukesh.user, other_role: MentorRole.enum.mentor });
    expect(toAsha?.card).toEqual({ name: "Mukesh", ...AS_HIS_COOK });
    expect(toMukesh).toMatchObject({ other: asha.user, other_role: MentorRole.enum.newcomer });
    expect(toAsha?.by).toEqual({ user: suresh.user, name: "Suresh" });
    expect(toAsha?.channel).toBe(toMukesh?.channel);

    const channel = await bothSayYes(asha, mukesh);
    const onAsha = await linkOf(asha, mukesh.user);
    expect(onAsha).toMatchObject({ kind: LinkKind.enum.mentor, mentor: { role: MentorRole.enum.newcomer } });
    expect((await linkOf(mukesh, asha.user))?.mentor?.role).toBe(MentorRole.enum.mentor);
    expect(onAsha?.channel).toBe(channel);
    expect(Date.parse(onAsha?.expires_at ?? "")).toBe(clock.now().getTime() + MENTOR_LINK_TTL_MS);
    expect(await asha.device.mentors.intros()).toEqual([]);

    await mukesh.device.mentors.send(asha.user, "Call me when you reach Majestic", "en");
    await all(mukesh, asha);
    const [note] = await asha.device.mentors.notes(mukesh.user);
    expect(note).toMatchObject({ from: NoteFrom.them, text: "Call me when you reach Majestic" });
  });

  it("through mentor links, live or ended: Suresh mentors Asha and once mentored Mukesh", async () => {
    const { suresh, asha, mukesh } = await threePhones();
    await seedLink(suresh, SURESH_CARD, asha, ASHA_N_CARD);
    await seedPastLink(suresh, mukesh.user, MUKESH_CARD);
    await seedPastLink(mukesh, suresh.user, SURESH_CARD);
    // On a live link the ask is a note in the link's thread.
    await asha.device.mentors.askAround(suresh.user, "bengaluru");
    await all(asha, suresh);
    expect((await suresh.device.mentors.notes(asha.user))[0]?.text).toContain("Bengaluru");

    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha, mukesh);
    expect((await asha.device.mentors.intros())[0]?.card).toEqual(MUKESH_CARD);
    await bothSayYes(asha, mukesh);
    expect((await linkOf(asha, mukesh.user))?.kind).toBe(LinkKind.enum.mentor);
  });

  it("a no from either side opens nothing", async () => {
    const { suresh, asha, mukesh } = await throughJobs();
    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha, mukesh);
    await asha.device.mentors.safetySeen();
    const [toAsha] = await asha.device.mentors.intros();
    const [toMukesh] = await mukesh.device.mentors.intros();
    await asha.device.mentors.answerIntro(toAsha?.channel ?? ("" as never), R.accept);
    await mukesh.device.mentors.answerIntro(toMukesh?.channel ?? ("" as never), R.decline);
    await all(asha, mukesh);
    expect(await linkOf(asha, mukesh.user)).toBeUndefined();
    expect(await linkOf(mukesh, asha.user)).toBeUndefined();
  });

  it("only people known through a signed job or a mentor link; a stranger's introduction is dropped", async () => {
    const { relay, suresh, asha, mukesh } = await threePhones();
    await seedJob({ phone: suresh, contact: SURESH }, { phone: asha, contact: ASHA_N });
    // A job only one side signed does not count.
    await seedJob({ phone: suresh, contact: SURESH }, { phone: mukesh, contact: MUKESH }, { signed: false });
    await expect(
      suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" }),
    ).rejects.toThrow(new MentorError(MentorRefusal.notKnown));
    await expect(suresh.device.mentors.askAround(mukesh.user, "bengaluru")).rejects.toThrow(
      new MentorError(MentorRefusal.notKnown),
    );

    const outsider = await stranger(relay);
    await outsider.send(asha.user, "eng_01J00000000000000000000000" as EngagementId, EnvelopeKind.enum.introduce, {
      other: mukesh.user,
      card: MUKESH_CARD,
      city: "bengaluru",
      other_role: MentorRole.enum.mentor,
      by: { user: outsider.user, name: "Friendly" },
    });
    // Nor does a note on a job's channel from someone who is not on that job.
    const [job] = await asha.device.store.jobs();
    await outsider.send(asha.user, job?.engagement.id as EngagementId, EnvelopeKind.enum.colleague_note, {
      text: "Pay me first",
      lang: "en",
    });
    await all(asha);
    expect(await asha.device.mentors.intros()).toEqual([]);
    expect((await asha.device.store.jobs())[0]?.notes).toBeUndefined();
  });

  it("someone blocked cannot be introduced, and their introductions stop showing", async () => {
    const { suresh, asha, mukesh } = await throughJobs();
    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha, mukesh);
    await asha.device.mentors.block(mukesh.user);
    expect(await asha.device.mentors.intros()).toEqual([]);
    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha);
    expect(await asha.device.mentors.intros()).toEqual([]);
    await suresh.device.mentors.block(mukesh.user);
    await expect(
      suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" }),
    ).rejects.toThrow(new MentorError(MentorRefusal.blocked));
  });
});
