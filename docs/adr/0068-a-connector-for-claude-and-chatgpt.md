# 0068: A connector for Claude, ChatGPT and other MCP clients

Status: proposed, tried locally

## Context

People already ask general assistants (Claude, ChatGPT) for help. A remote MCP server lets them add GigSync to such
an assistant by pasting one URL, and find workers by asking in their own words. MCP clients sign in with OAuth 2.1
(dynamic client registration, PKCE, protected resource metadata), so the server must be an OAuth authorization
server, and GigSync signs people in by phone code.

GigSync keeps the keys on the phone: mail is sealed to each device's key, and only devices sign. A server-side
connector holds no device keys, so it cannot read or send mail without becoming a copy of the person.

## Decision

1. **A Worker of its own, `workers/mcp`**, both OAuth authorization server and MCP resource (`/mcp`), built on
   `@cloudflare/workers-oauth-provider` and the MCP SDK's stateless web-standard Streamable HTTP transport. OAuth
   clients, grants and tokens live in KV (`OAUTH_KV`), tokens hashed and the grant's props encrypted per token.
2. **Sign-in is the app's**: the `/authorize` page asks for the number, then the code, and the API checks it at
   `POST /v1/auth/connector` with the same per-IP and per-number caps as the app. It proves the number by the dev code
   or a Firebase ID token for it, as `/v1/phone/confirm` does. Only a number that already has a GigSync account can
   connect: people join in the app, where their keys are made.
3. **A connector is not a device.** The API gives it a `con_` token in its own table (`connector_sessions`), never a
   row in `devices` or `sessions`, so no phone ever seals mail to it. That token opens only `/v1/connector/*`, and app
   tokens are refused there.
4. **Read-only tools**: `search_workers` (the board's search), `list_skills` and `my_card`. One scope, `gigsync:read`,
   shown on the consent page in plain words, with what the assistant cannot do.
5. **Sending and replying later, by phone approval**: the connector drafts, a push asks the phone, and the phone signs
   and sends. Keys never leave the phone.

## Consequences

- Searching from Claude or ChatGPT works with one SMS per connection; refresh tokens keep it without another.
- Real SMS on the sign-in page needs the Firebase web SDK (reCAPTCHA, then an ID token) on `/authorize`; until then
  only the dev code signs in, so the connector is not deployed.
- Deployment needs a KV namespace, `mcp.gigsync.network`, and `PUBLIC_ORIGIN`/`API_ORIGIN` set.
- Removing a connection in Claude revokes its OAuth tokens; the `con_` token stays valid until it expires (180 days)
  unless signed out. A "Connected assistants" list in the app, to end them, is follow-up work.
