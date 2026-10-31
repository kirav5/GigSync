import { DEFAULT_MENTOR_SLOTS, LinkKind, MENTOR_LINK_TTL_MS, MentorRole } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { MentorError, MentorRefusal, RequestState, settle } from "../src/index.js";
import {
  ASHA_N,
  ASHA_N_CARD,
  FakeMentorServer,
  LATA,
  MUKESH,
  MUKESH_CARD,
  mentorPhone,
  seedRecord,
  TestClock,
} from "./mentor-phones.js";
import { linkOf } from "./mentor-seeds.js";
import { MemoryRelay, type Phone, phone } from "./phones.js";

const DAYS_OF_WORK = 250;
const JOBS_DONE = 24;
const MS_PER_DAY = 86_400_000;
const FIND = { city: "bengaluru", trade: "cook", lang: "hi" } as const;
const ASK = {
  city: "bengaluru",
  trade: "cook",
  languages: ["hi"],
  arrival_week: "2026-11-09",
  area: "Koramangala",
} as const;

const choicesOf = (first_name: string, woman: boolean) => ({
  first_name,
  city: "bengaluru" as const,
  area: "Koramangala",
  trades: ["cook" as const],
  languages: ["hi" as const, "kn" as const],
  woman,
  women_only_newcomers: false,
  slots: DEFAULT_MENTOR_SLOTS,
});

async function world() {
  const relay = new MemoryRelay();
  const server = new FakeMentorServer();
  const clock = new TestClock(new Date("2026-10-29T10:00:00+05:30"));
  const [mukesh, lata, asha] = await Promise.all([
    mentorPhone(relay, server, MUKESH, clock),
    mentorPhone(relay, server, LATA, clock),
    mentorPhone(relay, server, ASHA_N, clock),
  ]);
  await seedRecord(mukesh, JOBS_DONE, DAYS_OF_WORK, clock.now());
  await seedRecord(lata, JOBS_DONE - 2, DAYS_OF_WORK, clock.now());
  await mukesh.device.mentors.publish(choicesOf("Mukesh", false));
  await lata.device.mentors.publish(choicesOf("Lata", true));
  return { relay, server, clock, mukesh, lata, asha };
}

const all = (...phones: Phone[]) => settle(phones.map((p) => p.device));

describe("a newcomer finds a mentor from the list", () => {
  it("lists only a worker whose own record reaches the minimum", async () => {
    const { relay, server, clock } = await world();
    const fresh = await mentorPhone(relay, server, { name: "Ravi", phone: "+919800000808" }, clock);
    await seedRecord(fresh, 5, 40, clock.now());
    await expect(fresh.device.mentors.publish(choicesOf("Ravi", false))).rejects.toThrow(
      new MentorError(MentorRefusal.notEligible),
    );
    expect(server.listings.has(fresh.user)).toBe(false);
  });

  it("women-only is on once she says she is a woman, shows only women mentors, and she may switch it off", async () => {
    const { asha, lata } = await world();
    expect((await asha.device.mentors.find(FIND)).map((p) => p.first_name)).toEqual(["Mukesh", "Lata"]);
    expect(await asha.device.mentors.answerWoman(true)).toMatchObject({ woman: true, women_only: true });
    expect((await asha.device.mentors.find(FIND)).map((p) => p.user)).toEqual([lata.user]);
    await asha.device.mentors.setWomenOnly(false);
    expect(await asha.device.mentors.find(FIND)).toHaveLength(2);
  });

  it("asks two mentors, takes one, and the other gets a polite close", async () => {
    const { asha, mukesh, lata, clock } = await world();
    const picks = await asha.device.mentors.find(FIND);
    // The safety words come before any contact.
    await expect(asha.device.mentors.request(picks, ASK, ASHA_N_CARD)).rejects.toThrow(
      new MentorError(MentorRefusal.safetyFirst),
    );
    await asha.device.mentors.safetySeen();
    const { sent, tooOld } = await asha.device.mentors.request(picks, ASK, ASHA_N_CARD);
    expect([sent.length, tooOld.length]).toEqual([2, 0]);
    await all(asha, mukesh, lata);

    const [asked] = await mukesh.device.mentors.incoming();
    expect(asked?.request).toMatchObject({ card: ASHA_N_CARD, arrival_week: "2026-11-09", area: "Koramangala" });
    await mukesh.device.mentors.offer(asked?.channel ?? ("" as never), MUKESH_CARD, "I'll meet you at the station");
    await all(mukesh, asha);
    const offered = (await asha.device.mentors.requests()).find((r) => r.mentor === mukesh.user);
    expect(offered).toMatchObject({ state: RequestState.offered, note: "I'll meet you at the station" });
    // What the newcomer is shown is the mentor's own phone's count.
    expect(offered?.card).toMatchObject({ jobs: JOBS_DONE, months: 8, vouched_by: null });

    await asha.device.mentors.confirm(offered?.channel ?? ("" as never));
    await all(asha, mukesh, lata);
    const onAsha = await linkOf(asha, mukesh.user);
    const onMukesh = await linkOf(mukesh, asha.user);
    expect(onAsha).toMatchObject({ kind: LinkKind.enum.mentor, mentor: { role: MentorRole.enum.newcomer, jobs: 24 } });
    expect(onMukesh).toMatchObject({ kind: LinkKind.enum.mentor, mentor: { role: MentorRole.enum.mentor } });
    expect(Date.parse(onAsha?.expires_at ?? "")).toBe(clock.now().getTime() + MENTOR_LINK_TTL_MS);
    expect(onAsha?.channel).toBe(onMukesh?.channel);

    // Lata never answered; her request was closed for her, and it leaves her Today.
    expect(await lata.device.mentors.incoming()).toEqual([]);
    expect((await asha.device.mentors.requests()).find((r) => r.mentor === lata.user)?.state).toBe(RequestState.closed);

    // The link carries notes both ways.
    await asha.device.mentors.send(mukesh.user, "नमस्ते", "hi");
    await all(asha, mukesh);
    expect((await mukesh.device.mentors.notes(asha.user)).map((n) => n.text)).toEqual(["नमस्ते"]);
  });

  it("a mentor says no, and the newcomer's request reads as declined", async () => {
    const { asha, mukesh } = await world();
    await asha.device.mentors.safetySeen();
    const [mukeshProfile] = (await asha.device.mentors.find(FIND)).filter((p) => p.user === mukesh.user);
    await asha.device.mentors.request(mukeshProfile ? [mukeshProfile] : [], ASK, ASHA_N_CARD);
    await all(asha, mukesh);
    const [asked] = await mukesh.device.mentors.incoming();
    await mukesh.device.mentors.decline(asked?.channel ?? ("" as never));
    await all(mukesh, asha);
    expect((await asha.device.mentors.requests())[0]?.state).toBe(RequestState.declined);
  });

  it("refuses more than three at once, and leaves out a mentor whose phone is too old", async () => {
    const { asha, relay } = await world();
    await asha.device.mentors.safetySeen();
    const picks = await asha.device.mentors.find(FIND);
    const four = [...picks, ...picks];
    await expect(asha.device.mentors.request(four, ASK, ASHA_N_CARD)).rejects.toThrow(
      new MentorError(MentorRefusal.tooMany),
    );
    const old = await phone(relay, { name: "Old", phone: "+919800000909" });
    const oldProfile = { ...(picks[0] ?? ({} as never)), user: old.user, first_name: "Old" };
    const { sent, tooOld } = await asha.device.mentors.request([oldProfile], ASK, ASHA_N_CARD);
    expect(sent).toEqual([]);
    expect(tooOld.map((p) => p.user)).toEqual([old.user]);
  });
});

describe("mentor links: renew, expiry, block and report", () => {
  async function linkedPair() {
    const w = await world();
    const { asha, mukesh } = w;
    await asha.device.mentors.safetySeen();
    const mine = (await asha.device.mentors.find(FIND)).filter((p) => p.user === mukesh.user);
    await asha.device.mentors.request(mine, ASK, ASHA_N_CARD);
    await all(asha, mukesh);
    const [asked] = await mukesh.device.mentors.incoming();
    await mukesh.device.mentors.offer(asked?.channel ?? ("" as never), MUKESH_CARD);
    await all(mukesh, asha);
    await asha.device.mentors.confirm(asked?.channel ?? ("" as never));
    await all(asha, mukesh);
    return w;
  }

  it("either side renews for another 30 days; once it runs out it is hidden and closed on both phones", async () => {
    const { asha, mukesh, clock } = await linkedPair();
    clock.advance(20 * MS_PER_DAY);
    await mukesh.device.mentors.renew(asha.user);
    await all(mukesh, asha);
    const renewed = clock.now().getTime() + MENTOR_LINK_TTL_MS;
    expect(Date.parse((await linkOf(asha, mukesh.user))?.expires_at ?? "")).toBe(renewed);
    clock.advance(31 * MS_PER_DAY);
    expect(await linkOf(asha, mukesh.user)).toBeUndefined();
    expect(await linkOf(mukesh, asha.user)).toBeUndefined();
    await expect(asha.device.mentors.send(mukesh.user, "hello", "en")).rejects.toThrow();
  });

  it("a block hides them everywhere on this phone, ends the link, and tells the server", async () => {
    const { asha, mukesh, server } = await linkedPair();
    await asha.device.mentors.report(mukesh.user, "asked_money");
    await asha.device.mentors.block(mukesh.user);
    await all(asha, mukesh);
    expect(await linkOf(asha, mukesh.user)).toBeUndefined();
    expect(await linkOf(mukesh, asha.user)).toBeUndefined();
    expect(server.reports).toEqual([{ user: mukesh.user, reason: "asked_money", by: asha.user }]);
    expect(server.blocks).toEqual([{ by: asha.user, user: mukesh.user }]);
    expect((await asha.device.mentors.find(FIND)).some((p) => p.user === mukesh.user)).toBe(false);
    expect((await asha.device.mentors.requests()).some((r) => r.mentor === mukesh.user)).toBe(false);
    // Nothing they send is kept any more: not a new request, not a note.
    await mukesh.device.mentors.safetySeen();
    await mukesh.device.mentors.request(
      [
        {
          user: asha.user,
          first_name: "Asha",
          city: "bengaluru",
          area: "x",
          trades: ["cook"],
          languages: ["hi"],
          months: 0,
          jobs: 0,
          vouched_by: null,
        },
      ],
      ASK,
      MUKESH_CARD,
    );
    await all(mukesh, asha);
    expect(await asha.device.mentors.incoming()).toEqual([]);
  });
});
