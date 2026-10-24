/**
 * The Tilekit REST API as served by the Tiles daemon on `main` (tilesprivacy/tiles, tiles/src/daemon). The daemon
 * binds loopback only, on a fixed port. Routes are pre-1.0 and moving (Tiles PR #277 turns the agent start/end
 * routes into POSTs), so every path lives here and nowhere else.
 */
export const DEFAULT_BASE_URL = "http://127.0.0.1:1729";
export const API_PREFIX = "/v1/tilekit";

/** The daemon's root answers with its version; it sits outside the Tilekit prefix. */
export const VERSION_PATH = "/";

export const Method = { get: "GET", post: "POST" } as const;
export type Method = (typeof Method)[keyof typeof Method];

export interface Route {
  readonly method: Method;
  readonly path: string;
}

export const Routes = {
  serverStart: { method: Method.post, path: "/server/start" },
  serverStop: { method: Method.post, path: "/server/stop" },
  serverPing: { method: Method.get, path: "/server/ping" },
  agentStart: { method: Method.get, path: "/agent/start" },
  agentEndSession: { method: Method.get, path: "/agent/end_session" },
  agentState: { method: Method.get, path: "/agent/state" },
  agentPrompt: { method: Method.post, path: "/agent/prompt" },
  sessionNew: { method: Method.post, path: "/session/new" },
  sessionList: { method: Method.get, path: "/session/list" },
  sessionChat: { method: Method.post, path: "/session/chat" },
  accountStatus: { method: Method.get, path: "/account/status" },
  accountCreate: { method: Method.post, path: "/account/create" },
  atprotoLogin: { method: Method.post, path: "/atproto/login" },
  atprotoLogout: { method: Method.post, path: "/atproto/logout" },
  atprotoStatus: { method: Method.get, path: "/atproto/status" },
} as const satisfies Record<string, Route>;

/** `GET /session/{id}/chats` is the one parameterised route. */
export function sessionChatsRoute(sessionId: string): Route {
  return { method: Method.get, path: `/session/${encodeURIComponent(sessionId)}/chats` };
}

/** Every Tilekit reply is wrapped in this envelope. */
export const ResponseStatus = { success: "success", failed: "failed" } as const;

export const ChatRole = { user: "user", assistant: "assistant", system: "system" } as const;
export type ChatRole = (typeof ChatRole)[keyof typeof ChatRole];

export const JSON_CONTENT_TYPE = "application/json";
export const SSE_CONTENT_TYPE = "text/event-stream";
