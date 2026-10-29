import Anthropic, { type ClientOptions } from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type {
  BetaContentBlock,
  BetaMessageParam,
  BetaToolUnion,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { type City, type EstimateRequest, QuoteExtraction } from "@gigsync/protocol";
import { SourceName } from "./constants.js";
import { estimateUnit } from "./normalise.js";
import type { QuoteSource } from "./source.js";
import type { FetchedPage, SourcedQuotes } from "./verify.js";

/** The model that reads pages. Thinking is always on for it: no `thinking` parameter is sent (a disabled one is a 400). */
const MODEL = "claude-opus-5-5";
const EFFORT = "medium";
/** Server-side fallback on a policy decline, with the model's default fallback chain (the "default" scalar form). */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const FALLBACKS = "default";
const MAX_OUTPUT_TOKENS = 16_000;
const MAX_SEARCHES = 5;
const MAX_FETCHES = 8;
/** Per fetched page. Eight pages at this size keep one estimate's page text, and the checks over it, small. */
const MAX_PAGE_TOKENS = 8_000;
/** Times a paused server-tool turn is resumed before the attempt counts as failed. */
const MAX_CONTINUATIONS = 3;
const TIMEOUT_MS = 5 * 60_000;
const MAX_RETRIES = 1;

const StopReason = { endTurn: "end_turn", pauseTurn: "pause_turn", refusal: "refusal" } as const;
const BlockType = { text: "text", fetchResult: "web_fetch_tool_result", fetched: "web_fetch_result" } as const;
const TEXT_SOURCE = "text";

/** Where a city is, for the search tool's location and the prompt. */
const PLACES: Readonly<Record<City, { name: string; region: string; country: string; timezone: string }>> = {
  bengaluru: { name: "Bengaluru", region: "Karnataka", country: "IN", timezone: "Asia/Kolkata" },
};

const SYSTEM = `You collect prices for household work in Indian cities from public web pages. You never estimate.

Search the web for what the described job costs in the described city, and fetch (with web_fetch) every page you take
a price from. Then list every price written on a fetched page for this kind of job in this city. For each price give:
- url: the fetched page's URL, exactly as fetched;
- sentence: the full sentence the price is written in, copied character for character from the page;
- amount_rupees: the number as written, in rupees (a range gives two quotes, one per number; "1.5 lakh" is 150000);
- unit: what the price is for (job, sqft, day, month, visit or hour);
- covers: only what the page says the price includes: area_sqft, rooms (bedrooms), people, meals (a day),
  materials_included, hours (a day or per visit), days. Leave out anything the page does not say;
- site: the page's domain.
Never compute, average, convert or infer a price that is not written. Leave out prices for other cities or other
work, and prices with no clear unit. If no fetched page states a price, return an empty list.

Scope values are buckets: bhkN is an N-bedroom home (bhk4_plus: four or more); 1_2, 3_4, 5_plus are people; up_to_6,
7_to_9, 10_plus are hours a day; labour_only yes means the household buys the materials.`;

/** The job as structured fields only: trade, city, scope buckets and the unit wanted. Never anyone's own words. */
function describeJob(req: EstimateRequest): string {
  const place = PLACES[req.city];
  const scope = Object.entries(req.scope)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");
  return `Trade: ${req.trade}\nCity: ${place.name}, ${place.region}, India\nScope: ${scope}\nPrice unit wanted: ${estimateUnit(req)}`;
}

function tools(req: EstimateRequest): BetaToolUnion[] {
  const place = PLACES[req.city];
  const location = { type: "approximate", city: place.name, region: place.region, country: place.country } as const;
  return [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: MAX_SEARCHES,
      user_location: { ...location, timezone: place.timezone },
    },
    // Called directly, never from code, so every fetched page comes back as a document the checks can read.
    {
      type: "web_fetch_20260209",
      name: "web_fetch",
      max_uses: MAX_FETCHES,
      max_content_tokens: MAX_PAGE_TOKENS,
      allowed_callers: ["direct"],
    },
  ];
}

/** The plain-text pages the web fetch returned in this response. PDFs and failed fetches are left out. */
function fetchedPages(content: readonly BetaContentBlock[]): FetchedPage[] {
  const pages: FetchedPage[] = [];
  for (const block of content) {
    if (block.type !== BlockType.fetchResult || block.content.type !== BlockType.fetched) continue;
    const source = block.content.content.source;
    if (source.type === TEXT_SOURCE) pages.push({ url: block.content.url, text: source.data });
  }
  return pages;
}

const hasQuoteList = (value: unknown): value is { quotes: unknown[] } =>
  typeof value === "object" && value !== null && "quotes" in value && Array.isArray(value.quotes);

/** The quotes in the last text block, each still unchecked; none when the answer is not the expected JSON. */
function quotesIn(content: readonly BetaContentBlock[]): unknown[] {
  const text = content.filter((b) => b.type === BlockType.text).at(-1)?.text;
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    return hasQuoteList(parsed) ? parsed.quotes : [];
  } catch {
    return [];
  }
}

/**
 * Reads the web with Claude: web search and fetch run on Anthropic's servers; the answer is structured JSON. A paused
 * turn (the server-side tool loop hit its limit) is resumed by sending the conversation back, up to
 * `MAX_CONTINUATIONS` times. Any other stop, a refusal included, fails the attempt; the caller answers "no estimate".
 */
export class AnthropicQuoteSource implements QuoteSource {
  readonly name = SourceName.anthropic;
  readonly cached = true;

  /** `fetch` is the platform's unless a test hands in its own; the SDK makes every call through it. */
  constructor(
    private readonly apiKey: string,
    private readonly fetch?: ClientOptions["fetch"],
  ) {}

  async quotes(req: EstimateRequest): Promise<SourcedQuotes> {
    const client = new Anthropic({
      apiKey: this.apiKey,
      maxRetries: MAX_RETRIES,
      timeout: TIMEOUT_MS,
      ...(this.fetch ? { fetch: this.fetch } : {}),
    });
    const messages: BetaMessageParam[] = [{ role: "user", content: describeJob(req) }];
    const pages: FetchedPage[] = [];
    // Sequential on purpose: each continuation resumes the turn the previous response paused.
    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        betas: [FALLBACK_BETA],
        fallbacks: FALLBACKS,
        system: SYSTEM,
        tools: tools(req),
        output_config: { effort: EFFORT, format: zodOutputFormat(QuoteExtraction) },
        messages,
      });
      pages.push(...fetchedPages(response.content));
      if (response.stop_reason === StopReason.pauseTurn) {
        messages.push({ role: "assistant", content: response.content });
        continue;
      }
      if (response.stop_reason !== StopReason.endTurn) {
        // A refusal names its policy category (or null); the caller logs it with the request.
        const detail =
          response.stop_reason === StopReason.refusal ? ` (${response.stop_details?.category ?? null})` : "";
        throw new Error(`model stopped: ${response.stop_reason}${detail}`);
      }
      return { pages, quotes: quotesIn(response.content) };
    }
    throw new Error("model paused too many times");
  }
}
