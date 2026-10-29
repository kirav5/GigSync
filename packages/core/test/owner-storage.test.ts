import type { Envelope, UserId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { Inbox, Outbox, OWNED_COLLECTIONS, OwnerStorage, PHONE_COLLECTIONS, settle } from "../src/index.js";
import { LinkStore } from "../src/mentor/link-store.js";
import { MentorStore } from "../src/mentor/store.js";
import { phoneOwners, sharedPhone, signInOn } from "./owners.js";
import { electrician, fanNeed, MemoryRelay, PRIYA, phone, RAVI } from "./phones.js";

const NOW = new Date("2026-10-29T10:00:00+05:30");
const GEETA = { name: "Geeta", phone: "+919800000505" };
const U = "01J0000000000000000000AAAA";

/** One envelope from someone outside the phone, as the mailbox hands it over. */
const envelope = (to: UserId): Envelope => ({
  v: 1,
  id: `msg_${U}`,
  from: { user: `usr_${U}`, device: `dev_${U}` },
  to: { user: to },
  engagement: `eng_${U}`,
  seq: 0,
  kind: "update",
  sent_at: NOW.toISOString(),
  expires_at: new Date(NOW.getTime() + 3600_000).toISOString(),
  ciphertext: "",
  sig: "",
});

describe("each owner's records on a shared phone", () => {
  it.each(OWNED_COLLECTIONS)("%s: each owner sees only their own", async (collection) => {
    const { phone, sita, geeta } = phoneOwners();
    const [mine, theirs] = [new OwnerStorage(phone, sita), new OwnerStorage(phone, geeta)];
    await mine.put(collection, "r1", { by: "sita" });
    expect(await theirs.get(collection, "r1")).toBeUndefined();
    expect(await theirs.list(collection)).toEqual([]);
    expect(await theirs.ids(collection)).toEqual([]);
    await theirs.delete(collection, "r1");
    expect(await mine.list(collection)).toEqual([{ by: "sita" }]);
    // Nothing is left where an older build, or another owner, would read it.
    expect(await phone.list(collection)).toEqual([]);
  });

  it("keeps the phone's own settings and the public guides shared by everyone on it", async () => {
    const { phone, sita, geeta } = phoneOwners();
    for (const collection of PHONE_COLLECTIONS) {
      await new OwnerStorage(phone, sita).put(collection, "lang", "kn");
      expect(await new OwnerStorage(phone, geeta).get(collection, "lang")).toBe("kn");
    }
  });

  it("never mixes two owners' mail: outbox, sequence numbers, seen ids and cursors", async () => {
    const { phone, sita, geeta } = phoneOwners();
    const [mine, theirs] = [new OwnerStorage(phone, sita), new OwnerStorage(phone, geeta)];
    await new Outbox(mine).enqueue(envelope(sita), NOW);
    expect(await new Outbox(theirs).due(NOW)).toEqual([]);
    expect(await new Outbox(mine).nextSeq("eng_x", "usr_y")).toBe(0);
    expect(await new Outbox(theirs).nextSeq("eng_x", "usr_y")).toBe(0);
    expect((await new Inbox(mine).accept(envelope(sita), NOW)).outcome).toBe("new");
    expect((await new Inbox(theirs).accept(envelope(geeta), NOW)).outcome).toBe("new");
    expect((await new Inbox(mine).accept(envelope(sita), NOW)).outcome).toBe("duplicate");
  });

  it("keeps the newcomer's answers, blocks and mentor links per owner", async () => {
    const { phone, sita, geeta } = phoneOwners();
    const [mine, theirs] = [new OwnerStorage(phone, sita), new OwnerStorage(phone, geeta)];
    await new MentorStore(mine).block(geeta, NOW);
    await new MentorStore(mine).saveNewcomer({ woman: true });
    expect(await new MentorStore(theirs).blocked()).toEqual(new Set());
    expect(await new MentorStore(theirs).newcomer()).toBeUndefined();
    expect(await new MentorStore(mine).isBlocked(geeta)).toBe(true);
    expect(await new LinkStore(theirs).list()).toEqual([]);
  });
});

describe("a shared phone's jobs", () => {
  it("belong to whoever is signed in: the next person sees none, the first sees all again", async () => {
    const relay = new MemoryRelay();
    const worker = await phone(relay, RAVI, { worker: electrician() });
    const shared = sharedPhone();
    const priya = await signInOn(shared, relay, PRIYA);
    const [job] = await priya.device.request(fanNeed(), [worker.user]);
    await settle([priya.device, worker.device]);
    // Priya's agent asked her what is wrong, and has a reply waiting to go out; then she signs out.
    expect(await priya.device.tasks()).not.toEqual([]);
    const id = job?.engagement.id;
    if (!id) throw new Error("no job");
    await priya.device.answer(id, { problem: "Fan hums" });
    const delivered = relay.stored.length;

    const geeta = await signInOn(shared, relay, GEETA);
    expect(await geeta.device.jobs()).toEqual([]);
    expect(await geeta.device.tasks()).toEqual([]);
    expect(await geeta.device.payments.all()).toEqual([]);
    // Geeta's phone never sends what Priya queued.
    expect((await geeta.device.sync()).sent).toBe(0);
    expect(relay.stored).toHaveLength(delivered);

    const back = await signInOn(shared, relay, PRIYA, priya.me);
    expect((await back.device.jobs()).map((j) => j.engagement.id)).toEqual([id]);
    expect((await back.device.sync()).sent).toBe(1);
  });
});
