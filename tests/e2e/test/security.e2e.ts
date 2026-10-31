import { HttpError, sealEnvelope } from "@gigsync/core";
import { type Envelope, PROTOCOL_VERSION } from "@gigsync/protocol";
import { ulid } from "ulid";
import { beforeAll, describe, expect, it } from "vitest";
import { API, type Person, person } from "./world.js";

let priya: Person;
let anil: Person;
let outsider: Person;
const HOUR_MS = 3600_000;

/** A genuine envelope from Priya to Anil, built the way her phone builds one, but not yet sent. */
async function fromPriya(): Promise<Envelope> {
  const { devices } = await priya.api.directory(anil.session.user);
  const now = Date.now();
  return sealEnvelope(
    {
      v: PROTOCOL_VERSION,
      id: `msg_${ulid(now)}`,
      from: { user: priya.session.user, device: priya.session.device },
      to: { user: anil.session.user },
      engagement: `eng_${ulid(now)}`,
      seq: 0,
      kind: "request",
      sent_at: new Date(now).toISOString(),
      expires_at: new Date(now + HOUR_MS).toISOString(),
    },
    { trade: "electrician", need: "Fan dead", when: "today", area: { lat: 12.9, lon: 77.6 } },
    devices.map((d) => ({ device: d.device_id, encryption_key: d.encryption_key })),
    priya.keys,
  );
}

const refused = (p: Promise<unknown>) => expect(p).rejects.toBeInstanceOf(HttpError);

beforeAll(async () => {
  [priya, anil, outsider] = await Promise.all([person("Priya"), person("Anil"), person("Outsider")]);
});

describe("the live server refuses what it must", () => {
  it("delivers a genuine envelope, sealed only to the recipient's device", async () => {
    const e = await fromPriya();
    expect(Object.keys(e.keys)).toEqual([anil.session.device]);
    expect(await priya.api.deliver(e)).toMatchObject({ stored: true });
    expect((await anil.api.inbox()).map((x) => x.id)).toContain(e.id);
    expect(await outsider.api.inbox()).toEqual([]);
    await anil.api.ack([e.id]);
  });

  it("refuses an envelope altered after signing", async () => {
    const e = await fromPriya();
    await refused(priya.api.deliver({ ...e, ciphertext: `${e.ciphertext.slice(0, -4)}AAA=` }));
    await refused(priya.api.deliver({ ...e, kind: "cancel" }));
    expect(await anil.api.inbox()).toEqual([]);
  });

  it("refuses Priya's envelope sent with someone else's session", async () => {
    await refused(outsider.api.deliver(await fromPriya()));
  });

  it("refuses every call without a session", async () => {
    for (const path of [
      "/v1/inbox",
      "/v1/board/workers?trade=maid&lat=12&lon=77",
      `/v1/directory/${anil.session.user}`,
    ])
      expect((await fetch(`${API}${path}`)).status).toBe(401);
  });

  it("refuses a made-up session token", async () => {
    const res = await fetch(`${API}/v1/inbox`, { headers: { authorization: "Bearer ses_made_up" } });
    expect(res.status).toBe(401);
  });
});
