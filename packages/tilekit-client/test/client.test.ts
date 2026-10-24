import { describe, expect, it } from "vitest";
import { ChatRole, readSse, TilekitClient, TilekitError } from "../src/index.js";

interface Call {
  url: string;
  init: RequestInit | undefined;
}

function fakeFetch(reply: () => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return reply();
  }) as typeof fetch;
  return { fetch: fn, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

describe("TilekitClient", () => {
  it("unwraps the success envelope and targets the Tilekit prefix", async () => {
    const { fetch, calls } = fakeFetch(() => json({ status: "success", data: { id: "s1" } }));
    const client = new TilekitClient({ baseUrl: "http://127.0.0.1:1729/", fetch });
    await expect(client.newSession()).resolves.toEqual({ id: "s1" });
    expect(calls[0]?.url).toBe("http://127.0.0.1:1729/v1/tilekit/session/new");
    expect(calls[0]?.init?.method).toBe("POST");
  });

  it("sends a JSON content type and body on every POST", async () => {
    const { fetch, calls } = fakeFetch(() => json({ status: "success", data: null }));
    await new TilekitClient({ fetch }).saveChat({ session_id: "s1", role: ChatRole.user, text: "hi" });
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ session_id: "s1", role: "user", text: "hi" });
  });

  it("sends no body on GET", async () => {
    const { fetch, calls } = fakeFetch(() => json({ status: "success", data: "pong" }));
    await expect(new TilekitClient({ fetch }).ping()).resolves.toBe("pong");
    expect(calls[0]?.init?.method).toBe("GET");
    expect(calls[0]?.init?.body).toBeUndefined();
  });

  it("encodes the session id in the chats route", async () => {
    const { fetch, calls } = fakeFetch(() => json({ status: "success", data: [] }));
    await new TilekitClient({ fetch }).sessionChats("a/b");
    expect(calls[0]?.url).toBe("http://127.0.0.1:1729/v1/tilekit/session/a%2Fb/chats");
  });

  it("throws TilekitError with the daemon's reason on a failed envelope", async () => {
    const { fetch } = fakeFetch(() => json({ status: "failed", reason: "no account" }, 404));
    const err = await new TilekitClient({ fetch }).accountStatus().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TilekitError);
    expect((err as TilekitError).message).toBe("no account");
    expect((err as TilekitError).httpStatus).toBe(404);
    expect((err as TilekitError).route).toBe("/account/status");
  });

  it("rejects a reply that is not an envelope", async () => {
    const { fetch } = fakeFetch(() => new Response("<html>", { status: 200 }));
    await expect(new TilekitClient({ fetch }).agentState()).rejects.toThrow("not a Tilekit envelope");
  });

  it("streams prompt events from the SSE body", async () => {
    const { fetch, calls } = fakeFetch(
      () => new Response(streamOf("event: agent_start\ndata: {}\n\n", 'event: message_end\ndata: {"t":1}\n\n')),
    );
    const events = [];
    for await (const e of new TilekitClient({ fetch }).prompt("Hello")) events.push(e);
    expect(events).toEqual([
      { event: "agent_start", data: "{}" },
      { event: "message_end", data: '{"t":1}' },
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ message: "Hello" });
  });

  it("reads the daemon version from the root", async () => {
    const { fetch, calls } = fakeFetch(() => new Response("0.4.2\n"));
    await expect(new TilekitClient({ fetch }).version()).resolves.toBe("0.4.2");
    expect(calls[0]?.url).toBe("http://127.0.0.1:1729/");
  });
});

describe("readSse", () => {
  const collect = async (body: ReadableStream<Uint8Array>) => {
    const out = [];
    for await (const e of readSse(body)) out.push(e);
    return out;
  };

  it("joins multi-line data and skips comments", async () => {
    expect(await collect(streamOf(": keepalive\n", "data: a\ndata: b\n\n"))).toEqual([
      { event: "message", data: "a\nb" },
    ]);
  });

  it("handles events split across chunks", async () => {
    expect(await collect(streamOf("event: x\nda", "ta: 1", "\n\n"))).toEqual([{ event: "x", data: "1" }]);
  });

  it("delivers a trailing event without a blank line", async () => {
    expect(await collect(streamOf("data: last"))).toEqual([{ event: "message", data: "last" }]);
  });
});
