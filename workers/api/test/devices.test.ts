import { HttpMethod } from "@gigsync/core";
import { describe, expect, it } from "vitest";
import { call } from "./mentor-helpers.js";
import { signIn } from "./people.js";

const PATH = "/devices/me/protocol";

describe("a device raises its protocol after an app update", () => {
  it("shows the new number in the directory, and never lowers it", async () => {
    const p = await signIn("+919844400101");
    expect((await call(p, HttpMethod.put, PATH, { protocol: 4 })).status).toBe(204);
    expect((await p.api.directory(p.session.user)).devices[0]?.protocol).toBe(4);
    expect((await call(p, HttpMethod.put, PATH, { protocol: 2 })).status).toBe(204);
    expect((await p.api.directory(p.session.user)).devices[0]?.protocol).toBe(4);
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
