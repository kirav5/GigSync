import { describe, expect, it } from "vitest";
import { AnthropicQuoteSource } from "../src/estimates/anthropic.js";
import { webBand } from "../src/estimates/compute.js";
import { COOK } from "./estimate-fakes.js";

/** Never a real key: every call below goes to the fake fetch, nothing reaches the network. */
const FAKE_KEY = "test-only-not-a-key";
const PAGE_URL = "https://cookhire.example/bengaluru";
const SENTENCE = "A cook for two meals a day in Bengaluru costs ₹10,000 to ₹12,000 a month.";

interface Sent {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

const message = (stop_reason: string, content: unknown[], stop_details: unknown = null) => ({
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content,
  stop_reason,
  stop_sequence: null,
  stop_details,
  usage: { input_tokens: 1, output_tokens: 1 },
});

const fetchedPage = (url: string, text: string) => ({
  type: "web_fetch_tool_result",
  tool_use_id: "srvtoolu_1",
  content: {
    type: "web_fetch_result",
    url,
    retrieved_at: null,
    content: {
      type: "document",
      title: null,
      citations: null,
      source: { type: "text", media_type: "text/plain", data: text },
    },
  },
});

const answer = (quotes: unknown[]) => ({ type: "text", text: JSON.stringify({ quotes }) });

const quote = (amount: number) => ({
  url: PAGE_URL,
  sentence: SENTENCE,
  amount_rupees: amount,
  unit: "month",
  covers: { meals: 2 },
  site: "cookhire.example",
});

/** A fetch that answers with the given messages in turn and records what was sent. */
function fakeFetch(replies: unknown[]) {
  const sent: Sent[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    sent.push({ url, headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    const reply = replies[Math.min(sent.length - 1, replies.length - 1)];
    return new Response(JSON.stringify(reply), { headers: { "content-type": "application/json" } });
  };
  return { fetch, sent };
}

describe("the Anthropic quote source", () => {
  it("asks claude-opus-5-5 at medium effort, with web search and fetch, structured output and fallbacks", async () => {
    const { fetch, sent } = fakeFetch([message("end_turn", [answer([])])]);
    await new AnthropicQuoteSource(FAKE_KEY, fetch).quotes(COOK);
    const [call] = sent;
    expect(call?.url).toContain("/v1/messages");
    expect(call?.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    const body = call?.body ?? {};
    expect(body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "medium" } });
    expect(body).not.toHaveProperty("thinking");
    expect((body.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    const tools = body.tools as { type: string; allowed_callers?: string[] }[];
    expect(tools.map((t) => t.type)).toEqual(["web_search_20260209", "web_fetch_20260209"]);
    expect(tools[1]?.allowed_callers).toEqual(["direct"]);
    const prompt = JSON.stringify(body.messages);
    expect(prompt).toContain("Trade: cook");
    expect(prompt).toContain("people: 3_4");
  });

  it("resumes a paused turn by sending the conversation back, keeping the pages from every response", async () => {
    const { fetch, sent } = fakeFetch([
      message("pause_turn", [
        { type: "server_tool_use", id: "srvtoolu_1", name: "web_fetch", input: {} },
        fetchedPage(PAGE_URL, `Guide. ${SENTENCE}`),
      ]),
      message("end_turn", [answer([quote(10000), quote(12000)])]),
    ]);
    const sourced = await new AnthropicQuoteSource(FAKE_KEY, fetch).quotes(COOK);
    expect(sent).toHaveLength(2);
    const resent = sent[1]?.body.messages as { role: string }[];
    expect(resent.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(sourced.pages).toEqual([{ url: PAGE_URL, text: `Guide. ${SENTENCE}` }]);
    expect(sourced.quotes).toHaveLength(2);
    const { dropped } = webBand(COOK, sourced);
    expect(dropped).toEqual([]);
  });

  it("fails on a refusal, naming its category", async () => {
    const refused = message("refusal", [], { type: "refusal", category: "cyber", explanation: null });
    const { fetch } = fakeFetch([refused]);
    await expect(new AnthropicQuoteSource(FAKE_KEY, fetch).quotes(COOK)).rejects.toThrow(
      "model stopped: refusal (cyber)",
    );
  });

  it("gives up after three continuations", async () => {
    const { fetch, sent } = fakeFetch([message("pause_turn", [])]);
    await expect(new AnthropicQuoteSource(FAKE_KEY, fetch).quotes(COOK)).rejects.toThrow("paused too many times");
    expect(sent).toHaveLength(4);
  });

  it("returns no quotes when the answer is not the expected JSON", async () => {
    const { fetch } = fakeFetch([message("end_turn", [{ type: "text", text: "I could not find prices." }])]);
    expect((await new AnthropicQuoteSource(FAKE_KEY, fetch).quotes(COOK)).quotes).toEqual([]);
  });
});
