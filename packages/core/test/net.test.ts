import type { Envelope, UserId } from "@gigsync/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiPath, HttpError, NetError, NetReason, REQUEST_TIMEOUT_MS } from "../src/index.js";

const BASE = "https://api.test";
const U = "01J0000000000000000000AAAA";
const PHONE = "+919800000000";
const now = new Date("2026-10-29T10:00:00+05:30");
/** The DOMException name AbortSignal.timeout aborts with. */
const TIMEOUT_ERROR = "TimeoutError";

/** A well-formed sealed envelope; digits are valid Crockford base32, so a padded number makes a test ULID. */
const envelope = (n: number): Envelope => ({
  v: 1,
  id: `msg_${String(n).padStart(26, "0")}`,
  from: { user: `usr_${U}`, device: `dev_${U}` },
  to: { user: `usr_${U}` },
  engagement: `eng_${U}`,
  seq: n,
  kind: "update",
  sent_at: now.toISOString(),
  expires_at: new Date(now.getTime() + 3600_000).toISOString(),
  epk: "AAAA",
  keys: { [`dev_${U}`]: "AAAA" },
  ciphertext: "",
  sig: "",
});

type Call = { url: string; init?: RequestInit };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A fake fetch answering from `reply`, recording each call. */
function fakeFetch(reply: (call: Call) => Promise<Response>) {
  const calls: Call[] = [];
  const fetchFn = (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return reply({ url, init });
  };
  return { calls, client: new ApiClient(BASE, fetchFn) };
}

/** AbortSignal.timeout on fake timers, so a test can move the clock past the deadline. */
function fakeDeadline() {
  vi.useFakeTimers();
  return vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("timed out", TIMEOUT_ERROR)), ms);
    return controller.signal;
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ApiClient deadlines", () => {
  it("gives up on a fetch that never answers after REQUEST_TIMEOUT_MS, as a timeout", async () => {
    const timeout = fakeDeadline();
    const { client } = fakeFetch(() => new Promise<Response>(() => undefined));
    let settled = false;
    const outcome = client.requestOtp(PHONE).then(
      () => undefined,
      (err: unknown) => {
        settled = true;
        return err;
      },
    );
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const err = await outcome;
    expect(err).toBeInstanceOf(NetError);
    expect((err as NetError).reason).toBe(NetReason.timeout);
    expect(timeout).toHaveBeenCalledWith(REQUEST_TIMEOUT_MS);
  });

  it("hands the deadline to fetch, and a fetch that honours it also ends as a timeout", async () => {
    fakeDeadline();
    const { calls, client } = fakeFetch(
      ({ init }) =>
        new Promise<Response>((_, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", TIMEOUT_ERROR))),
        ),
    );
    const outcome = client.requestOtp(PHONE).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(await outcome).toMatchObject({ reason: NetReason.timeout });
  });

  it("keeps the deadline on a web view without AbortSignal.timeout (iOS 15)", async () => {
    vi.useFakeTimers();
    const native = AbortSignal.timeout;
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true });
    try {
      const { client } = fakeFetch(() => new Promise<Response>(() => undefined));
      const outcome = client.requestOtp(PHONE).catch((err: unknown) => err);
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      expect(await outcome).toMatchObject({ reason: NetReason.timeout });
    } finally {
      Object.defineProperty(AbortSignal, "timeout", { value: native, configurable: true });
    }
  });

  it("calls a fetch that throws TypeError (no network) offline", async () => {
    const { client } = fakeFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const err = await client.requestOtp(PHONE).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetError);
    expect((err as NetError).reason).toBe(NetReason.offline);
  });

  it("keeps an error answer an HttpError with its status and message", async () => {
    const { client } = fakeFetch(() => Promise.resolve(json({ error: "bad phone" }, 400)));
    const err = await client.requestOtp(PHONE).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 400, error: "bad phone" });
  });

  it("answers in time without a timeout firing later", async () => {
    fakeDeadline();
    const { client } = fakeFetch(() => Promise.resolve(json({ ok: true })));
    await expect(client.requestOtp(PHONE)).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
  });
});

describe("ApiClient inbox", () => {
  const unknownKind = { ...envelope(2), kind: "from_a_newer_app" };
  const noId = { kind: "update", garbage: true };

  it("skips an envelope it cannot parse, acknowledges it alone, and returns the rest", async () => {
    const { calls, client } = fakeFetch(({ url }) =>
      Promise.resolve(
        url.endsWith(ApiPath.ack) ? json({ acked: 1 }) : json([envelope(1), unknownKind, noId, envelope(3)]),
      ),
    );
    const got = await client.inbox();
    expect(got.map((e) => e.seq)).toEqual([1, 3]);
    const acks = calls.filter((c) => c.url.endsWith(ApiPath.ack));
    expect(acks).toHaveLength(1);
    expect(JSON.parse(String(acks[0]?.init?.body))).toEqual({ ids: [unknownKind.id] });
  });

  it("sends no acknowledgement when everything parses", async () => {
    const { calls, client } = fakeFetch(() => Promise.resolve(json([envelope(1)])));
    expect(await client.inbox()).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it("still returns the readable envelopes when acknowledging the unreadable one fails", async () => {
    const { client } = fakeFetch(({ url }) =>
      url.endsWith(ApiPath.ack)
        ? Promise.reject(new TypeError("Failed to fetch"))
        : Promise.resolve(json([envelope(1), unknownKind])),
    );
    expect((await client.inbox()).map((e) => e.seq)).toEqual([1]);
  });

  it("refuses an answer that is not a list at all", async () => {
    const { client } = fakeFetch(() => Promise.resolve(json({ envelopes: [] })));
    await expect(client.inbox()).rejects.toThrow();
  });
});

describe("ApiClient worker card", () => {
  const user = `usr_${U}` as UserId;
  const card = {
    display_name: "Ravi",
    trades: ["electrician"],
    area: { lat: 12.97, lon: 77.64 },
    area_name: "Indiranagar",
    rate_paise: 70000,
    languages: ["kn"],
    about: "",
    record: { jobs: 4, rated: 3, average: 4.7, came_back: 1 },
  };

  it("reads one worker's served card, record and all", async () => {
    const { calls, client } = fakeFetch(() => Promise.resolve(json(card)));
    expect(await client.workerCard(user)).toEqual(card);
    expect(calls[0]?.url).toBe(`${BASE}${ApiPath.boardWorkers}/${user}`);
  });

  it("answers undefined for a worker not on the board, and passes on any other error", async () => {
    const missing = fakeFetch(() => Promise.resolve(json({ error: "not found" }, 404)));
    expect(await missing.client.workerCard(user)).toBeUndefined();
    const refused = fakeFetch(() => Promise.resolve(json({ error: "unauthorized" }, 401)));
    await expect(refused.client.workerCard(user)).rejects.toBeInstanceOf(HttpError);
  });
});
