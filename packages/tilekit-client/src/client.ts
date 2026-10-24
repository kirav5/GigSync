import {
  API_PREFIX,
  ChatRole,
  DEFAULT_BASE_URL,
  JSON_CONTENT_TYPE,
  Method,
  ResponseStatus,
  type Route,
  Routes,
  SSE_CONTENT_TYPE,
  sessionChatsRoute,
  VERSION_PATH,
} from "./routes.js";
import { readSse, type SseEvent } from "./sse.js";

/** Thrown for a `{status:"failed"}` reply, a non-2xx status, or a reply that is not a Tilekit envelope. */
export class TilekitError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly route: string,
  ) {
    super(message);
    this.name = "TilekitError";
  }
}

export interface TilekitClientOptions {
  /** Defaults to the daemon's fixed loopback address. */
  baseUrl?: string;
  /** Injected for tests and for runtimes without a global fetch. */
  fetch?: typeof fetch;
}

export interface SaveChatRequest {
  session_id: string;
  role: ChatRole;
  text: string;
  parent_chat_id?: string;
}

interface Envelope {
  status: string;
  data?: unknown;
  reason?: string;
}

const HEADER_CONTENT_TYPE = "content-type";
const HEADER_ACCEPT = "accept";

function isEnvelope(value: unknown): value is Envelope {
  return typeof value === "object" && value !== null && typeof (value as Envelope).status === "string";
}

/**
 * Talks to a local Tiles daemon. Every POST carries a JSON content type, which Tiles PR #277 will require to stop
 * browser CSRF. The daemon's CORS list only admits Tauri and localhost:5173, so call this from the Desk's Tauri
 * shell or from Node, not from an arbitrary web origin.
 */
export class TilekitClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: TilekitClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** The daemon's version string, from `GET /`. */
  async version(): Promise<string> {
    const res = await this.fetchImpl(`${this.baseUrl}${VERSION_PATH}`);
    if (!res.ok) throw new TilekitError(`daemon answered ${res.status}`, res.status, VERSION_PATH);
    return (await res.text()).trim();
  }

  ping(): Promise<unknown> {
    return this.call(Routes.serverPing);
  }

  startServer(): Promise<unknown> {
    return this.call(Routes.serverStart);
  }

  stopServer(): Promise<unknown> {
    return this.call(Routes.serverStop);
  }

  startAgent(): Promise<unknown> {
    return this.call(Routes.agentStart);
  }

  endAgentSession(): Promise<unknown> {
    return this.call(Routes.agentEndSession);
  }

  agentState(): Promise<unknown> {
    return this.call(Routes.agentState);
  }

  async newSession(): Promise<{ id: string }> {
    const data = await this.call(Routes.sessionNew);
    const id = (data as { id?: unknown } | null)?.id;
    if (typeof id !== "string") throw new TilekitError("session/new returned no id", 200, Routes.sessionNew.path);
    return { id };
  }

  listSessions(): Promise<unknown> {
    return this.call(Routes.sessionList);
  }

  sessionChats(sessionId: string): Promise<unknown> {
    return this.call(sessionChatsRoute(sessionId));
  }

  saveChat(request: SaveChatRequest): Promise<unknown> {
    return this.call(Routes.sessionChat, request);
  }

  accountStatus(): Promise<unknown> {
    return this.call(Routes.accountStatus);
  }

  createAccount(nickname: string): Promise<unknown> {
    return this.call(Routes.accountCreate, { nickname });
  }

  /**
   * Sends one prompt to the Pi agent and yields its events as they stream. Event names are Pi RPC event types
   * (`agent_start`, `message_end`, `agent_settled`, …); `data` is Pi's raw JSON.
   */
  async *prompt(message: string, signal?: AbortSignal): AsyncGenerator<SseEvent> {
    const route = Routes.agentPrompt;
    const res = await this.send(route, { message }, SSE_CONTENT_TYPE, signal);
    if (!res.ok || !res.body) throw await this.failure(res, route);
    yield* readSse(res.body);
  }

  /** Calls a route and returns the envelope's `data`. */
  private async call(route: Route, body?: unknown): Promise<unknown> {
    const res = await this.send(route, body, JSON_CONTENT_TYPE);
    if (!res.ok) throw await this.failure(res, route);
    const parsed: unknown = await res.json().catch(() => null);
    if (!isEnvelope(parsed)) throw new TilekitError("reply is not a Tilekit envelope", res.status, route.path);
    if (parsed.status !== ResponseStatus.success) {
      throw new TilekitError(parsed.reason ?? "request failed", res.status, route.path);
    }
    return parsed.data ?? null;
  }

  private send(route: Route, body: unknown, accept: string, signal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { [HEADER_ACCEPT]: accept };
    const init: RequestInit = { method: route.method, headers };
    if (route.method === Method.post) {
      headers[HEADER_CONTENT_TYPE] = JSON_CONTENT_TYPE;
      init.body = JSON.stringify(body ?? {});
    }
    if (signal) init.signal = signal;
    return this.fetchImpl(`${this.baseUrl}${API_PREFIX}${route.path}`, init);
  }

  private async failure(res: Response, route: Route): Promise<TilekitError> {
    const parsed: unknown = await res.json().catch(() => null);
    const reason = isEnvelope(parsed) && parsed.reason ? parsed.reason : `HTTP ${res.status}`;
    return new TilekitError(reason, res.status, route.path);
  }
}

export { ChatRole };
