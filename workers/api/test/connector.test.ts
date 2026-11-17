import { SELF } from "cloudflare:test";
import { ConnectorSession } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { signIn } from "./people.js";

/** Connected assistants (ADR 0068): sign-in without a device, and the few routes their token opens. */

/** Pune, so these workers never meet the ones other test files list. */
const HERE = { lat: 18.52, lon: 73.85 };

function call(path: string, init: { method?: string; token?: string; body?: unknown; ip?: string } = {}) {
  const headers: Record<string, string> = { "cf-connecting-ip": init.ip ?? `ip-${path}` };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const body = init.body === undefined ? null : JSON.stringify(init.body);
  return SELF.fetch(`http://x/v1${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body });
}

async function connect(phone: string): Promise<ConnectorSession> {
  const res = await call("/auth/connector", { body: { phone, code: "000000" }, ip: phone });
  expect(res.status).toBe(200);
  return ConnectorSession.parse(await res.json());
}

const devicesOf = async (owner: { session: { token: string; user: string } }) => {
  const res = await call(`/directory/${owner.session.user}`, { token: owner.session.token });
  return ((await res.json()) as { devices: unknown[] }).devices.length;
};

describe("connected assistants", () => {
  it("signs in an existing owner without adding a device", async () => {
    const owner = await signIn("+919822000001");
    const before = await devicesOf(owner);
    const session = await connect("+919822000001");
    expect(session.user).toBe(owner.session.user);
    expect(session.token.startsWith("con_")).toBe(true);
    expect(await devicesOf(owner)).toBe(before);
  });

  it("refuses a number with no GigSync account, a wrong code and a bad body", async () => {
    const none = await call("/auth/connector", { body: { phone: "+919822000099", code: "000000" } });
    expect(none.status).toBe(404);
    await signIn("+919822000002");
    const wrong = await call("/auth/connector", { body: { phone: "+919822000002", code: "123456" } });
    expect(wrong.status).toBe(401);
    expect((await call("/auth/connector", { body: { phone: "nope" } })).status).toBe(400);
  });

  it("searches the board and reads the owner's own card", async () => {
    const worker = await signIn("+919822000003");
    await worker.api.publishProfile({
      display_name: "Ganesh",
      trades: ["electrician"],
      area: HERE,
      area_name: "Pune",
      rate_paise: 50000,
      languages: ["mr", "en"],
      about: "",
    });
    const { token } = await connect("+919822000003");
    const found = await call(`/connector/workers?trade=electrician&lat=${HERE.lat}&lon=${HERE.lon}`, { token });
    expect(found.status).toBe(200);
    const { workers } = (await found.json()) as { workers: { display_name: string }[] };
    expect(workers.map((w) => w.display_name)).toContain("Ganesh");
    expect((await call(`/connector/workers?lat=${HERE.lat}&lon=${HERE.lon}`, { token })).status).toBe(400);
    const card = await call("/connector/card", { token });
    expect(card.status).toBe(200);
    expect(((await card.json()) as { display_name: string }).display_name).toBe("Ganesh");
    expect((await call("/connector/skills", { token })).status).toBe(200);
  });

  it("keeps the two kinds of token apart", async () => {
    const owner = await signIn("+919822000004");
    const { token } = await connect("+919822000004");
    expect((await call("/connector/card", {})).status).toBe(401);
    expect((await call("/connector/card", { token: owner.session.token })).status).toBe(401);
    expect((await call("/inbox", { token })).status).toBe(401);
    expect((await call("/board/profile", { token })).status).toBe(401);
  });

  it("stops working once signed out", async () => {
    await signIn("+919822000005");
    const { token } = await connect("+919822000005");
    const out = await call("/connector/session", { method: "DELETE", token });
    expect(await out.json()).toEqual({ revoked: true });
    expect((await call("/connector/skills", { token })).status).toBe(401);
  });
});
