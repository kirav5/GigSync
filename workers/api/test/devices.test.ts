import { HttpMethod } from "@gigsync/core";
import { MENTOR_PROTOCOL, TERMS_PROTOCOL } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { type Person, signIn } from "./people.js";

const PATH = "/devices/me/protocol";

describe("a device raises its protocol after an app update", () => {
  it("shows the new number in the directory, and never lowers it", async () => {
    const p = await signIn("+919844400101");
    expect((await call(p, HttpMethod.put, PATH, { protocol: 4 })).status).toBe(204);
    expect((await p.api.directory(p.session.user)).devices[0]?.protocol).toBe(4);
    expect((await call(p, HttpMethod.put, PATH, { protocol: 2 })).status).toBe(204);
    expect((await p.api.directory(p.session.user)).devices[0]?.protocol).toBe(4);
  });

  it("lists a phone that understands terms besides the price, so other phones send it terms", async () => {
    const p = await signIn("+919844400103");
    expect((await call(p, HttpMethod.put, PATH, { protocol: MENTOR_PROTOCOL })).status).toBe(204);
    expect((await call(p, HttpMethod.put, PATH, { protocol: TERMS_PROTOCOL })).status).toBe(204);
    expect((await p.api.directory(p.session.user)).devices[0]?.protocol).toBe(TERMS_PROTOCOL);
  });

  it("refuses a bad number", async () => {
    const p = await signIn("+919844400102");
    expect((await call(p, HttpMethod.put, PATH, { protocol: 0 })).status).toBe(400);
    expect((await call(p, HttpMethod.put, PATH, { protocol: "4" })).status).toBe(400);
  });

  it("needs a session", async () => {
    expect((await call(undefined, HttpMethod.put, PATH, { protocol: 4 })).status).toBe(401);
  });
});

describe("the new phone revokes the old one", () => {
  const revoke = (as: Person, device: string) => call(as, HttpMethod.delete, `/devices/${device}`);

  it("ends the old device's sessions and takes it out of the directory", async () => {
    const old = await signIn("+919888800101");
    const fresh = await signIn("+919888800101");
    expect((await revoke(fresh, old.session.device)).status).toBe(204);
    expect((await call(old, HttpMethod.get, `/directory/${old.session.user}`)).status).toBe(401);
    const { devices } = await fresh.api.directory(fresh.session.user);
    expect(devices.map((d) => d.device_id)).toEqual([fresh.session.device]);
    expect((await revoke(fresh, old.session.device)).status).toBe(404);
  });

  it("refuses the calling device, another person's device and a bad id", async () => {
    const p = await signIn("+919888800102");
    const stranger = await signIn("+919888800103");
    expect((await revoke(p, p.session.device)).status).toBe(409);
    expect((await revoke(p, stranger.session.device)).status).toBe(404);
    expect((await stranger.api.directory(stranger.session.user)).devices).toHaveLength(1);
    expect((await revoke(p, "dev-1")).status).toBe(400);
    expect((await call(undefined, HttpMethod.delete, `/devices/${p.session.device}`)).status).toBe(401);
  });
});
