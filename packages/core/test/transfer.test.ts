import { toBase64Url } from "@gigsync/crypto";
import type { TransferId, UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import { describe, expect, it } from "vitest";
import {
  applyMerge,
  Collection,
  collectRecords,
  DEVICE_BOUND,
  HttpError,
  MergeChoice,
  MOVED_COLLECTIONS,
  MoveError,
  MoveProblem,
  moveCode,
  OwnerStorage,
  offerMove,
  openMove,
  packMove,
  planMerge,
  readMoveCode,
  readPackage,
  revokeOldPhone,
} from "../src/index.js";
import { MemoryTransfers, movingOwner } from "./transfer-fakes.js";

const NOW = new Date("2026-10-31T10:00:00+05:30");
const JOB = { engagement: { id: "eng_1", status: "agreed" }, price_paise: 70000 };
const SLOT = `xfr_${ulid()}` as TransferId;
const KEY = toBase64Url(new Uint8Array(32).fill(7));

/** The old phone of someone who used GigSync: a job, a payment, a chat, a UPI ID and a queued envelope. */
async function oldPhoneWithHistory() {
  const owner = movingOwner();
  const s = owner.old.storage;
  await s.put(Collection.jobs, "eng_1", JOB);
  await s.put(Collection.payments, "pay_1", { id: "pay_1", amount_paise: 70000 });
  await s.put(Collection.chat, "cht_1", { id: "cht_1", turns: ["hello"] });
  await s.put(Collection.ownerSettings, "payee", { vpa: "ravi@okaxis", name: "Ravi" });
  await s.put(Collection.outbox, "msg_1", { envelope: { id: "msg_1" } });
  await s.put(Collection.settings, "lang", "hi");
  return owner;
}

const encoder = new TextEncoder();
const bytesOf = (value: unknown) => encoder.encode(JSON.stringify(value));

describe("what moves", () => {
  it("collects every record of the owner, but not the phone's settings, the outbox or another owner's", async () => {
    const owner = await oldPhoneWithHistory();
    const other = new OwnerStorage(owner.old.base, `usr_${ulid()}` as UserId);
    await other.put(Collection.jobs, "eng_9", { theirs: true });
    const records = await collectRecords(owner.old.storage);
    expect(Object.keys(records).sort()).toEqual(
      [Collection.chat, Collection.jobs, Collection.ownerSettings, Collection.payments].sort(),
    );
    expect(records[Collection.jobs]).toEqual([{ id: "eng_1", value: JOB }]);
    expect(MOVED_COLLECTIONS).not.toContain(Collection.settings);
    expect(MOVED_COLLECTIONS).not.toContain(Collection.guides);
    for (const bound of DEVICE_BOUND) expect(MOVED_COLLECTIONS).not.toContain(bound);
  });

  it("leaves the chats behind first when the package would not fit, and says so", async () => {
    const owner = await oldPhoneWithHistory();
    const records = await collectRecords(owner.old.storage);
    const full = packMove({ owner: owner.user, now: NOW, records }, Number.MAX_SAFE_INTEGER);
    const withoutChat = { ...records };
    delete withoutChat[Collection.chat];
    const slim = packMove({ owner: owner.user, now: NOW, records: withoutChat }, Number.MAX_SAFE_INTEGER);
    const limit = Math.ceil(((slim.bytes.length + 80) * 4) / 3);
    const packed = packMove({ owner: owner.user, now: NOW, records }, limit);
    expect(full.package.left_out).toEqual([]);
    expect(packed.package.left_out).toEqual([Collection.chat]);
    expect(packed.package.records[Collection.jobs]).toHaveLength(1);
  });

  it("refuses when even without the chats it is too big", async () => {
    const owner = await oldPhoneWithHistory();
    const records = await collectRecords(owner.old.storage);
    expect(() => packMove({ owner: owner.user, now: NOW, records }, 100)).toThrow(
      expect.objectContaining({ problem: MoveProblem.too_big }),
    );
  });
});

describe("reading a package", () => {
  const owner = `usr_${ulid()}` as UserId;
  const valid = { format: "gigsync-move", v: 1, owner, made_at: NOW.toISOString(), records: {}, left_out: [] };
  const problem = (value: unknown, who: UserId = owner) => {
    try {
      readPackage(bytesOf(value), who);
      return undefined;
    } catch (err) {
      return err instanceof MoveError ? err.problem : err;
    }
  };

  it("reads its own version, and skips collections it does not know", () => {
    const read = readPackage(bytesOf({ ...valid, lang: "kn", records: { jobs: [], future_thing: [] } }), owner);
    expect(read.lang).toBe("kn");
    expect(Object.keys(read.records)).toEqual(["jobs"]);
  });

  it("refuses a newer version, another owner's package, and anything malformed", () => {
    expect(problem({ ...valid, v: 2 })).toBe(MoveProblem.newer);
    expect(problem(valid, `usr_${ulid()}` as UserId)).toBe(MoveProblem.not_yours);
    expect(problem({ ...valid, format: "other" })).toBe(MoveProblem.damaged);
    expect(problem({ ...valid, records: { jobs: [{ value: 1 }] } })).toBe(MoveProblem.damaged);
    expect(() => readPackage(encoder.encode("{not json"), owner)).toThrow(MoveError);
  });
});

describe("the move QR's text", () => {
  it("carries the slot and the key, and nothing else reads as one", () => {
    const text = moveCode({ slot: SLOT, key: KEY });
    expect(readMoveCode(text)).toEqual({ slot: SLOT, key: KEY });
    expect(readMoveCode(` ${text}\n`)).toEqual({ slot: SLOT, key: KEY });
    expect(readMoveCode("https://gigsync.app/?to=qr_abc")).toBeUndefined();
    expect(readMoveCode(`gigsync-move:${SLOT}`)).toBeUndefined();
    expect(readMoveCode(`gigsync-move:${SLOT}.short`)).toBeUndefined();
    expect(readMoveCode(`gigsync-move:${SLOT}.${KEY}.extra`)).toBeUndefined();
  });
});

describe("moving from the old phone to the new one", () => {
  it("everything arrives on the new phone, the server holds only ciphertext, and the old phone is signed out", async () => {
    const owner = await oldPhoneWithHistory();
    const server = new MemoryTransfers();
    const offer = await offerMove(owner.old.storage, server.for({ user: owner.user, device: owner.old.device }), {
      owner: owner.user,
      lang: "hi",
      now: NOW,
    });
    expect(offer).toMatchObject({ left_out: [], records: 4, unsent: 1 });
    const [slot] = [...server.slots.values()];
    expect(slot?.ciphertext).not.toContain("ravi@okaxis");
    expect(slot?.ciphertext).not.toContain(readMoveCode(offer.text)?.key);

    const api = server.for({ user: owner.user, device: owner.fresh.device });
    const opened = await openMove(api, { owner: owner.user, device: owner.fresh.device, text: offer.text });
    expect(opened.from).toBe(owner.old.device);
    expect(opened.package.lang).toBe("hi");
    const plan = await planMerge(owner.fresh.storage, opened.package.records);
    expect(plan).toMatchObject({ conflicts: [], same: 0 });
    expect(await applyMerge(owner.fresh.storage, plan, MergeChoice.keepMine)).toBe(4);
    await revokeOldPhone(api, opened.from);

    expect(await owner.fresh.storage.get(Collection.jobs, "eng_1")).toEqual(JOB);
    expect(await owner.fresh.storage.get(Collection.ownerSettings, "payee")).toMatchObject({ vpa: "ravi@okaxis" });
    expect(await owner.fresh.storage.ids(Collection.outbox)).toEqual([]);
    expect(server.revoked.has(owner.old.device)).toBe(true);
    // A retry after a lost answer is safe.
    await expect(revokeOldPhone(api, opened.from)).resolves.toBeUndefined();
  });

  it("never overwrites what differs on the new phone unless the owner says so", async () => {
    const owner = await oldPhoneWithHistory();
    const fresh = owner.fresh.storage;
    await fresh.put(Collection.jobs, "eng_1", { ...JOB, price_paise: 80000 });
    await fresh.put(Collection.payments, "pay_1", { id: "pay_1", amount_paise: 70000 });
    const plan = await planMerge(fresh, await collectRecords(owner.old.storage));
    expect(plan.same).toBe(1);
    expect(plan.conflicts.map((c) => c.id)).toEqual(["eng_1"]);
    await applyMerge(fresh, plan, MergeChoice.keepMine);
    expect(await fresh.get(Collection.jobs, "eng_1")).toMatchObject({ price_paise: 80000 });
    await applyMerge(fresh, plan, MergeChoice.takeTheirs);
    expect(await fresh.get(Collection.jobs, "eng_1")).toEqual(JOB);
  });

  it("a code works once, for 15 minutes, for the same number, from another phone", async () => {
    const owner = await oldPhoneWithHistory();
    const server = new MemoryTransfers();
    const oldApi = server.for({ user: owner.user, device: owner.old.device });
    const offerOn = async () => (await offerMove(owner.old.storage, oldApi, { owner: owner.user, now: NOW })).text;
    const newApi = server.for({ user: owner.user, device: owner.fresh.device });
    const open = (text: string, api = newApi, who = owner.user, device = owner.fresh.device) =>
      openMove(api, { owner: who, device, text }).then(
        () => undefined,
        (err: unknown) => (err instanceof MoveError ? err.problem : err),
      );

    const once = await offerOn();
    expect(await open(once)).toBeUndefined();
    expect(await open(once)).toBe(MoveProblem.gone);

    const late = await offerOn();
    server.now += 16 * 60_000;
    expect(await open(late)).toBe(MoveProblem.expired);

    const stranger = `usr_${ulid()}` as UserId;
    expect(await open(await offerOn(), server.for({ user: stranger, device: owner.fresh.device }), stranger)).toBe(
      MoveProblem.gone,
    );
    expect(await open(await offerOn(), oldApi, owner.user, owner.old.device)).toBe(MoveProblem.same_phone);
    expect(await open("https://gigsync.app/?to=qr_abc")).toBe(MoveProblem.not_move);
  });

  it("a code with the wrong key, or an altered box, does not open", async () => {
    const owner = await oldPhoneWithHistory();
    const server = new MemoryTransfers();
    const oldApi = server.for({ user: owner.user, device: owner.old.device });
    const { text } = await offerMove(owner.old.storage, oldApi, { owner: owner.user, now: NOW });
    const qr = readMoveCode(text);
    const wrongKey = moveCode({ slot: qr?.slot as TransferId, key: KEY });
    const newApi = server.for({ user: owner.user, device: owner.fresh.device });
    await expect(openMove(newApi, { owner: owner.user, device: owner.fresh.device, text: wrongKey })).rejects.toThrow(
      expect.objectContaining({ problem: MoveProblem.damaged }),
    );
  });

  it("says why the server refused: too big, too many codes this hour", async () => {
    const owner = await oldPhoneWithHistory();
    const refusing = (status: number) => ({
      ...new MemoryTransfers().for({ user: owner.user, device: owner.old.device }),
      uploadTransfer: async () => Promise.reject(new HttpError(status, "no")),
    });
    for (const [status, problem] of [
      [413, MoveProblem.too_big],
      [429, MoveProblem.too_many],
    ] as const) {
      await expect(offerMove(owner.old.storage, refusing(status), { owner: owner.user, now: NOW })).rejects.toThrow(
        expect.objectContaining({ problem }),
      );
    }
    await expect(offerMove(owner.old.storage, refusing(500), { owner: owner.user, now: NOW })).rejects.toThrow(
      HttpError,
    );
  });
});
