import { SearchDay, TimeWindow, Trade, WorkCategory } from "@gigsync/protocol";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { ApiFailure, myCard, searchWorkers, skills } from "./api.js";
import { type Env, Props } from "./env.js";

/**
 * GigSync's tools for a connected assistant (ADR 0068): read-only, as the person who signed in. Each MCP request gets
 * a fresh server and a stateless transport: nothing is kept between calls but the person's grant.
 */

const SERVER = { name: "gigsync", version: "0.1.0" } as const;
const PAISE_PER_RUPEE = 100;

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
const failure = (message: string) => ({ isError: true, content: [{ type: "text" as const, text: message }] });

/** The API's refusal in words the assistant can pass on; a revoked connection is told to reconnect. */
function failed(err: unknown) {
  if (err instanceof ApiFailure && err.status === 401) {
    return failure("GigSync signed this connection out. Remove GigSync and add it again to sign in.");
  }
  if (err instanceof ApiFailure && err.status === 400) return failure(`GigSync refused the search: ${err.message}.`);
  return failure("GigSync could not be reached. Try again in a moment.");
}

const searchShape = {
  trade: Trade.optional().describe("A trade, e.g. electrician. Give exactly one of trade, category or skill."),
  category: WorkCategory.optional().describe("A kind of work, e.g. fridge_repair."),
  skill: z.string().optional().describe("A skill key from list_skills, e.g. kitchen chimney cleaning."),
  lat: z.number().min(-90).max(90).describe("Latitude of where the work is (the area is enough)."),
  lon: z.number().min(-180).max(180).describe("Longitude of where the work is."),
  radius_km: z.number().positive().max(25).optional().describe("How far to look, in km (default 5)."),
  max_rate_rupees: z.number().int().positive().optional().describe("Highest usual rate, in rupees."),
  day: SearchDay.optional().describe("The day the work is needed."),
  window: TimeWindow.optional().describe("Part of that day."),
};
type SearchArgs = { [K in keyof typeof searchShape]: z.infer<(typeof searchShape)[K]> };

function queryOf(args: SearchArgs): URLSearchParams {
  const query = new URLSearchParams({ lat: String(args.lat), lon: String(args.lon) });
  const plain = { trade: args.trade, category: args.category, skill: args.skill, day: args.day, window: args.window };
  for (const [key, value] of Object.entries(plain)) if (value) query.set(key, value);
  if (args.radius_km) query.set("radius_km", String(args.radius_km));
  if (args.max_rate_rupees) query.set("max_rate_paise", String(args.max_rate_rupees * PAISE_PER_RUPEE));
  return query;
}

function serverFor(env: Env, props: Props): McpServer {
  const server = new McpServer(SERVER, {
    instructions:
      "GigSync finds local workers (electricians, plumbers, maids, cooks and more) in Indian cities. Search by trade, " +
      "kind of work or skill near a latitude and longitude. To ask a worker or agree a job, the person uses the " +
      "GigSync app: this connection cannot send messages.",
  });
  const origin = env.API_ORIGIN;
  const token = props.apiToken;
  server.registerTool(
    "search_workers",
    {
      description: "Find GigSync workers near a place, nearest first, with their usual rate, languages and record.",
      inputSchema: searchShape,
      annotations: { readOnlyHint: true },
    },
    async (args) => {
      const asked = [args.trade, args.category, args.skill].filter(Boolean).length;
      if (asked !== 1) return failure("Give exactly one of trade, category or skill.");
      try {
        const { workers } = await searchWorkers(origin, token, queryOf(args));
        return text({ count: workers.length, workers });
      } catch (err) {
        return failed(err);
      }
    },
  );
  server.registerTool(
    "list_skills",
    {
      description: "The skills GigSync workers list, with their keys for search_workers.",
      annotations: { readOnlyHint: true },
    },
    async () => skills(origin, token).then(text, failed),
  );
  server.registerTool(
    "my_card",
    {
      description: "The signed-in person's own worker card, if they have published one.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      myCard(origin, token).then(text, (err: unknown) =>
        err instanceof ApiFailure && err.status === 404
          ? text({ card: null, note: "No card published yet." })
          : failed(err),
      ),
  );
  return server;
}

/** The MCP endpoint, behind the OAuth provider: `ctx.props` is the signed-in person's grant. */
export const mcpHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const props = Props.safeParse(ctx.props);
    if (!props.success) return Response.json({ error: "unauthorized" }, { status: 401 });
    // No session id: stateless, one request per server.
    const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
    await serverFor(env, props.data).connect(transport);
    return transport.handleRequest(request);
  },
};
