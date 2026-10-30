import type { DeviceId, Session, TransferId } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { ApiPath, HttpError, NewPhoneClient, NewPhonePath } from "../src/index.js";

const BASE = "https://api.test";
const U = "01J0000000000000000000AAAA";
const SESSION: Session = { token: "tok", user: `usr_${U}`, device: `dev_${U}` } as Session;
const SLOT = `xfr_${U}` as TransferId;
const OLD = `dev_${U.replace("AAAA", "ZZZZ")}` as DeviceId;
const CIPHER = "AAAA";

type Call = { url: string; init?: RequestInit };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function client(reply: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    calls.push({ url, ...(init ? { init } : {}) });
    return reply({ url, ...(init ? { init } : {}) });
  };
  return { calls, api: new NewPhoneClient(BASE, fetchFn, SESSION) };
}

describe("NewPhoneClient", () => {
  it("uploads to a slot and downloads from it, as the signed-in device", async () => {
    const expires = "2026-10-31T10:15:00.000Z";
    const { calls, api } = client(({ init }) =>
      init?.method === "POST"
        ? json({ id: SLOT, expires_at: expires }, 201)
        : json({ ciphertext: CIPHER, device: OLD }),
    );
    expect(await api.uploadTransfer({ ciphertext: CIPHER })).toEqual({ id: SLOT, expires_at: expires });
    expect(await api.downloadTransfer(SLOT)).toEqual({ ciphertext: CIPHER, device: OLD });
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([
      ["POST", `${BASE}${NewPhonePath.transfer}`],
      ["GET", `${BASE}${NewPhonePath.transfer}/${SLOT}`],
    ]);
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer tok");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ ciphertext: CIPHER });
  });

  it("refuses a download that is not what the protocol says", async () => {
    const { api } = client(() => json({ ciphertext: CIPHER }));
    await expect(api.downloadTransfer(SLOT)).rejects.toThrow();
  });

  it("revokes the old device by id", async () => {
    const { calls, api } = client(() => new Response(null, { status: 204 }));
    await api.revokeDevice(OLD);
    expect(calls[0]).toMatchObject({ url: `${BASE}${NewPhonePath.devices}${OLD}`, init: { method: "DELETE" } });
  });

  it("reads the owner's own card; none on the board is undefined", async () => {
    const card = {
      display_name: "Ravi",
      trades: ["electrician"],
      area: { lat: 12.97, lon: 77.64 },
      area_name: "Indiranagar",
      rate_paise: 70000,
      languages: ["kn"],
      about: "",
    };
    expect(await client(() => json(card)).api.myCard()).toMatchObject({ rate_paise: 70000 });
    expect(await client(() => json({ error: "not found" }, 404)).api.myCard()).toBeUndefined();
    await expect(client(() => json({ error: "unauthorized" }, 401)).api.myCard()).rejects.toThrow(HttpError);
    expect(client(() => json(card)).calls).toEqual([]);
    const { calls, api } = client(() => json(card));
    await api.myCard();
    expect(calls[0]?.url).toBe(`${BASE}${ApiPath.boardProfile}`);
  });

  it("knows the device was signed out by its new phone only from a 401", async () => {
    expect(await client(() => json({ error: "not found" }, 404)).api.stillSignedIn()).toBe(true);
    expect(await client(() => json({ error: "unauthorized" }, 401)).api.stillSignedIn()).toBe(false);
  });
});
