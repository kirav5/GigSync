import { EnvelopeKind, LinkKind, MENTOR_LINK_TTL_MS, MentorReply, MentorRole } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { MentorError, MentorRefusal, NoteFrom, settle } from "../src/index.js";
import { colleagueOf, linked, SURESH_CARD, stranger } from "./colleague-phones.js";
import { ASHA_N, ASHA_N_CARD, FakeMentorServer, MUKESH, MUKESH_CARD, mentorPhone, TestClock } from "./mentor-phones.js";
import { MemoryRelay, type Phone } from "./phones.js";

const SURESH = { name: "Suresh", phone: "+919800000111" };
const R = MentorReply.enum;

/** Suresh knows both: he met Asha (moving to Bengaluru) and Mukesh (who works there), and linked with each by QR. */
async function threePhones() {
  const relay = new MemoryRelay();
  const server = new FakeMentorServer();
  const clock = new TestClock(new Date("2026-10-29T10:00:00+05:30"));
  const [suresh, asha, mukesh] = await Promise.all([
    mentorPhone(relay, server, SURESH, clock),
    mentorPhone(relay, server, ASHA_N, clock),
    mentorPhone(relay, server, MUKESH, clock),
  ]);
  await linked(suresh, SURESH_CARD, asha, ASHA_N_CARD);
  await linked(suresh, SURESH_CARD, mukesh, MUKESH_CARD);
  return { relay, clock, suresh, asha, mukesh };
}

const all = (...phones: Phone[]) => settle(phones.map((p) => p.device));

describe("introductions through people you know", () => {
  it("Asha asks Suresh, Suresh introduces Mukesh, both say yes, and a mentor link opens with no code", async () => {
    const { clock, suresh, asha, mukesh } = await threePhones();
    await asha.device.mentors.askAround(suresh.user, "bengaluru");
    await all(asha, suresh);
    const [ask] = await suresh.device.colleagues.notes(asha.user);
    expect(ask).toMatchObject({ from: NoteFrom.them, lang: "en" });
    expect(ask?.text).toContain("Bengaluru");

    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha, mukesh);
    const [toAsha] = await asha.device.mentors.intros();
    const [toMukesh] = await mukesh.device.mentors.intros();
    expect(toAsha).toMatchObject({ other: mukesh.user, card: MUKESH_CARD, other_role: MentorRole.enum.mentor });
    expect(toMukesh).toMatchObject({ other: asha.user, card: ASHA_N_CARD, other_role: MentorRole.enum.newcomer });
    expect(toAsha?.by).toEqual({ user: suresh.user, name: "Suresh" });
    expect(toAsha?.channel).toBe(toMukesh?.channel);

    await asha.device.mentors.safetySeen();
    await asha.device.mentors.answerIntro(toAsha?.channel ?? ("" as never), R.accept);
    await all(asha, mukesh);
    // One yes is not a link.
    expect(await colleagueOf(asha, mukesh.user)).toBeUndefined();
    expect((await mukesh.device.mentors.intros())[0]?.theirs).toBe(R.accept);

    await mukesh.device.mentors.safetySeen();
    await mukesh.device.mentors.answerIntro(toMukesh?.channel ?? ("" as never), R.accept);
    await all(mukesh, asha);
    const onAsha = await colleagueOf(asha, mukesh.user);
    const onMukesh = await colleagueOf(mukesh, asha.user);
    expect(onAsha).toMatchObject({
      kind: LinkKind.enum.mentor,
      card: MUKESH_CARD,
      mentor: { role: MentorRole.enum.newcomer },
    });
    expect(onMukesh).toMatchObject({
      kind: LinkKind.enum.mentor,
      card: ASHA_N_CARD,
      mentor: { role: MentorRole.enum.mentor },
    });
    expect(onAsha?.channel).toBe(toAsha?.channel);
    expect(Date.parse(onAsha?.expires_at ?? "")).toBe(clock.now().getTime() + MENTOR_LINK_TTL_MS);
    expect(await asha.device.mentors.intros()).toEqual([]);

    await mukesh.device.colleagues.send(asha.user, "Call me when you reach Majestic", "en");
    await all(mukesh, asha);
    expect((await asha.device.colleagues.notes(mukesh.user)).map((n) => n.text)).toEqual([
      "Call me when you reach Majestic",
    ]);
  });

  it("a no from either side opens nothing", async () => {
    const { suresh, asha, mukesh } = await threePhones();
    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha, mukesh);
    await asha.device.mentors.safetySeen();
    const [toAsha] = await asha.device.mentors.intros();
    const [toMukesh] = await mukesh.device.mentors.intros();
    await asha.device.mentors.answerIntro(toAsha?.channel ?? ("" as never), R.accept);
    await mukesh.device.mentors.answerIntro(toMukesh?.channel ?? ("" as never), R.decline);
    await all(asha, mukesh);
    expect(await colleagueOf(asha, mukesh.user)).toBeUndefined();
    expect(await colleagueOf(mukesh, asha.user)).toBeUndefined();
  });

  it("only linked colleagues can be introduced, and an introduction from a stranger is dropped", async () => {
    const { relay, suresh, asha, mukesh } = await threePhones();
    const outsider = await stranger(relay);
    await expect(
      suresh.device.mentors.introduce({ newcomer: asha.user, mentor: outsider.user, city: "bengaluru" }),
    ).rejects.toThrow(new MentorError(MentorRefusal.notLinked));
    await outsider.send(asha.user, "eng_01J00000000000000000000000" as never, EnvelopeKind.enum.introduce, {
      other: mukesh.user,
      card: MUKESH_CARD,
      city: "bengaluru",
      other_role: MentorRole.enum.mentor,
      by: { user: outsider.user, name: "Friendly" },
    });
    await all(asha);
    expect(await asha.device.mentors.intros()).toEqual([]);
  });

  it("someone blocked cannot be introduced, and their introductions stop showing", async () => {
    const { suresh, asha, mukesh } = await threePhones();
    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha, mukesh);
    await asha.device.mentors.block(mukesh.user);
    expect(await asha.device.mentors.intros()).toEqual([]);
    await suresh.device.mentors.introduce({ newcomer: asha.user, mentor: mukesh.user, city: "bengaluru" });
    await all(suresh, asha);
    expect(await asha.device.mentors.intros()).toEqual([]);
  });
});
