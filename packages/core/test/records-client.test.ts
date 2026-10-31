import { type EngagementId, RECORDS_NOTICE_VERSION, type Session } from "@gigsync/protocol";
import { describe, expect, it } from "vitest";
import { cachedOwnCard, HttpError, MemoryStorage, RecordsClient, RecordsPath, refreshOwnCard } from "../src/index.js";

const BASE = "https://api.test";
const U = "01J0000000000000000000AAAA";
const SESSION: Session = { token: "tok", user: `usr_${U}`, device: `dev_${U}` } as Session;
const JOB = `eng_${U}` as EngagementId;

type Call = { url: string; init?: RequestInit };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function client(reply: (call: Call) => Response) {
  const calls: Call[] = [];
  const fetchFn = async (url: string, init?: RequestInit) => {
    const call = { url, ...(init ? { init } : {}) };
    calls.push(call);
    return reply(call);
  };
  return { calls, api: new RecordsClient(BASE, fetchFn, SESSION) };
}

const CARD = {
  display_name: "Ravi",
  trades: ["electrician"],
  area: { lat: 12.97, lon: 77.64 },
  area_name: "Indiranagar",
  rate_paise: 70000,
  languages: ["kn"],
  about: "",
  record: { jobs: 4, rated: 3, average: 4.7 },
  show_record: false,
};

describe("RecordsClient", () => {
  it("sends a job's later facts to that job's routes, as the signed-in device", async () => {
    const { calls, api } = client(() => new Response(null, { status: 204 }));
    await api.reportStatus(JOB, { status: "done" });
    await api.reportStars(JOB, { stars: 4 });
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([
      ["POST", `${BASE}${RecordsPath.jobs}/${JOB}${RecordsPath.status}`],
      ["PUT", `${BASE}${RecordsPath.jobs}/${JOB}${RecordsPath.stars}`],
    ]);
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer tok");
  });

  it("accepts the notice shown now, and reads none accepted as undefined", async () => {
    const accepted = { notice_version: RECORDS_NOTICE_VERSION, accepted_at: "2026-10-31T10:00:00Z", current: true };
    const { calls, api } = client(({ init }) =>
      init?.method === "PUT" ? json(accepted) : json({ error: "not found" }, 404),
    );
    expect(await api.consent()).toBeUndefined();
    expect(await api.acceptConsent()).toEqual(accepted);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ notice_version: RECORDS_NOTICE_VERSION });
  });

  it("pages the export by cursor, and refuses an answer the protocol does not allow", async () => {
    const { calls, api } = client(() => json({ jobs: [] }));
    await api.myJobRecords({ after: JOB, limit: 50 });
    expect(calls[0]?.url).toBe(`${BASE}${RecordsPath.mine}?after=${JOB}&limit=50`);
    const bad = client(() => json({ jobs: [{ engagement: JOB }] }));
    await expect(bad.api.myJobRecords()).rejects.toThrow();
  });

  it("keeps the owner's served card for the next paint, null when off the board, and the old one on failure", async () => {
    const storage = new MemoryStorage();
    expect(await refreshOwnCard(client(() => json(CARD)).api, storage)).toMatchObject({ show_record: false });
    expect((await cachedOwnCard(storage))?.record?.jobs).toBe(4);
    const failing = client(() => json({ error: "busy" }, 503)).api;
    await expect(refreshOwnCard(failing, storage)).rejects.toBeInstanceOf(HttpError);
    expect((await cachedOwnCard(storage))?.record?.jobs).toBe(4);
    await refreshOwnCard(client(() => json({ error: "not found" }, 404)).api, storage);
    expect(await cachedOwnCard(storage)).toBeNull();
  });
});
