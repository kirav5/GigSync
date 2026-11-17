import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { authorize } from "./authorize.js";
import { type Env, MCP_PATH, Scope } from "./env.js";
import { mcpHandler } from "./tools.js";

/**
 * The GigSync connector (ADR 0068). One Worker is both the OAuth authorization server (sign-in by phone code, consent,
 * tokens, client registration for Claude and ChatGPT) and the MCP resource at /mcp. The provider is built on the first
 * request, because its canonical URLs come from PUBLIC_ORIGIN (a tunnel's address while it is tried locally).
 */

const Endpoint = { authorize: "/authorize", token: "/oauth/token", register: "/oauth/register" } as const;
/** An hour per access token; the refresh token keeps the connection without another SMS. */
const ACCESS_TOKEN_TTL_S = 3600;

let provider: OAuthProvider<Env> | undefined;

function providerFor(env: Env): OAuthProvider<Env> {
  provider ??= new OAuthProvider<Env>({
    apiRoute: MCP_PATH,
    apiHandler: mcpHandler,
    defaultHandler: { fetch: (request, env) => authorize(request, env as Env) },
    authorizeEndpoint: Endpoint.authorize,
    tokenEndpoint: Endpoint.token,
    clientRegistrationEndpoint: Endpoint.register,
    scopesSupported: [Scope.read],
    requiredScopes: [Scope.read],
    accessTokenTTL: ACCESS_TOKEN_TTL_S,
    resourceMetadata: {
      resource: `${env.PUBLIC_ORIGIN}${MCP_PATH}`,
      authorization_servers: [env.PUBLIC_ORIGIN],
      resource_name: "GigSync",
    },
  });
  return provider;
}

/**
 * A request for this Worker's own host, on the scheme people reach it by. Behind a tunnel, `wrangler dev` sees plain
 * http; the OAuth URLs it builds must still be the https ones clients were given.
 */
function onPublicOrigin(request: Request, publicOrigin: string): Request {
  const url = new URL(request.url);
  const origin = new URL(publicOrigin);
  if (url.host !== origin.host || url.protocol === origin.protocol) return request;
  url.protocol = origin.protocol;
  return new Request(url, request);
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return providerFor(env).fetch(onPublicOrigin(request, env.PUBLIC_ORIGIN), env, ctx);
  },
} satisfies ExportedHandler<Env>;
