import { HttpMethod } from "@gigsync/core";
import { TRANSFER_MAX_CHARS, TRANSFERS_PER_HOUR, type TransferSlot } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { type Person, signIn } from "./people.js";
import { sql } from "./sql.js";

const PATH = "/transfer";
/** Stands in for the old phone's sealed data: the server only sees base64. */
const SEALED = "c2VhbGVkIG93bmVyIGRhdGE=";
const EXPIRE_SQL = `UPDATE transfer_slots SET created_at = now() - interval '1 hour', expires_at = now() - interval '1 minute'
  WHERE slot_id = $1`;
const SLOTS_SQL = "SELECT slot_id FROM transfer_slots WHERE slot_id = $1";

async function upload(as: Person, ciphertext = SEALED): Promise<TransferSlot> {
  const res = await call(as, HttpMethod.post, PATH, { ciphertext });
  expect(res.status).toBe(201);
  return res.json();
}

const download = (as: Person | undefined, id: string) => call(as, HttpMethod.get, `${PATH}/${id}`);

/** The same number signed in on an old phone and then a new one. */
async function twoPhones(phone: string): Promise<[Person, Person]> {
  const old = await signIn(phone);
  const fresh = await signIn(phone);
  expect(fresh.session.user).toBe(old.session.user);
  return [old, fresh];
}

describe("moving to a new phone through a transfer slot", () => {
  it("hands the new phone the ciphertext and the old device once, then forgets it", async () => {
    const [old, fresh] = await twoPhones("+919888800001");
    const slot = await upload(old);
    expect(Date.parse(slot.expires_at)).toBeGreaterThan(Date.now());
    const res = await download(fresh, slot.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ciphertext: SEALED, device: old.session.device });
    expect((await download(fresh, slot.id)).status).toBe(404);
    expect(await sql(SLOTS_SQL, [slot.id])).toEqual([]);
  });

  it("keeps one slot per person: a new upload replaces the last", async () => {
    const [old, fresh] = await twoPhones("+919888800002");
    const first = await upload(old);
    const second = await upload(old, "c2Vjb25k");
    expect((await download(fresh, first.id)).status).toBe(404);
    expect(await (await download(fresh, second.id)).json()).toMatchObject({ ciphertext: "c2Vjb25k" });
  });

  it("never lets another person download a slot, nor spends it", async () => {
    const [old, fresh] = await twoPhones("+919888800003");
    const stranger = await signIn("+919888800004");
    const slot = await upload(old);
    expect((await download(stranger, slot.id)).status).toBe(404);
    expect((await download(fresh, slot.id)).status).toBe(200);
  });

  it("refuses an expired slot with 410 and deletes it, and purges others' expired slots on use", async () => {
    const [old, fresh] = await twoPhones("+919888800005");
    const slot = await upload(old);
    await sql(EXPIRE_SQL, [slot.id]);
    expect((await download(fresh, slot.id)).status).toBe(410);
    expect((await download(fresh, slot.id)).status).toBe(404);

    const other = await signIn("+919888800006");
    const stale = await upload(other);
    await sql(EXPIRE_SQL, [stale.id]);
    await upload(old);
    expect(await sql(SLOTS_SQL, [stale.id])).toEqual([]);
  });

  it("refuses bad input: no or non-base64 ciphertext, a bad slot id, a body over the cap", async () => {
    const p = await signIn("+919888800007");
    expect((await call(p, HttpMethod.post, PATH, {})).status).toBe(400);
    expect((await call(p, HttpMethod.post, PATH, { ciphertext: "not base64!" })).status).toBe(400);
    expect((await call(p, HttpMethod.post, PATH, "not json")).status).toBe(400);
    expect((await download(p, "slot-1")).status).toBe(400);
    const huge = { ciphertext: "A".repeat(TRANSFER_MAX_CHARS + 2048) };
    expect((await call(p, HttpMethod.post, PATH, huge)).status).toBe(413);
  });

  it("caps slots per person per hour", async () => {
    const p = await signIn("+919888800008");
    for (let i = 0; i < TRANSFERS_PER_HOUR; i++) await upload(p);
    expect((await call(p, HttpMethod.post, PATH, { ciphertext: SEALED })).status).toBe(429);
    const other = await signIn("+919888800009");
    await upload(other);
  });

  it("needs a session", async () => {
    expect((await call(undefined, HttpMethod.post, PATH, { ciphertext: SEALED })).status).toBe(401);
    expect((await download(undefined, "xfr_01J0000000000000000000AAAA")).status).toBe(401);
  });
});
