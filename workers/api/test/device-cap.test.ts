import { HttpMethod, SecretKeys } from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import { MAX_RECIPIENT_DEVICES } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

/** Architecture review row 3: a person's devices stay within what one envelope can reach. */
describe("a person's devices", () => {
  it("stay one row when the same phone signs in again", async () => {
    const keys = new SecretKeys(newDeviceSecrets());
    const first = await signIn("+919844600001", keys);
    const again = await signIn("+919844600001", keys);
    expect(again.session.device).toBe(first.session.device);
    expect((await again.api.directory(again.session.user)).devices).toHaveLength(1);
    // Both sessions still work: signing in again does not sign the phone out.
    expect((await call(first, HttpMethod.get, "/inbox")).status).toBe(200);
  });

  it("never pass the cap: the oldest is retired and its session stops working", async () => {
    const phones = [];
    for (let i = 0; i <= MAX_RECIPIENT_DEVICES; i++)
      phones.push(await signIn("+919844600002", new SecretKeys(newDeviceSecrets()), `10.0.0.${i}`));
    const newest = phones.at(-1);
    const oldest = phones[0];
    if (!newest || !oldest) throw new Error("no phones");
    const { devices } = await newest.api.directory(newest.session.user);
    expect(devices).toHaveLength(MAX_RECIPIENT_DEVICES);
    expect(devices.map((d) => d.device_id)).not.toContain(oldest.session.device);
    expect((await call(oldest, HttpMethod.get, "/inbox")).status).toBe(401);
    expect((await call(newest, HttpMethod.get, "/inbox")).status).toBe(200);
  });

  it("lose a phone on sign-out: nobody seals to it, and its token stops working", async () => {
    const keys = new SecretKeys(newDeviceSecrets());
    const phone = await signIn("+919844600003", keys);
    const other = await signIn("+919844600003");
    expect((await call(phone, HttpMethod.post, "/me/signout")).status).toBe(204);
    expect((await call(phone, HttpMethod.get, "/inbox")).status).toBe(401);
    const { devices } = await other.api.directory(other.session.user);
    expect(devices.map((d) => d.device_id)).toEqual([other.session.device]);
    // Signing in again on that phone gives it a new row: a revoked device stays revoked.
    const back = await signIn("+919844600003", keys);
    expect(back.session.device).not.toBe(phone.session.device);
  });
});
