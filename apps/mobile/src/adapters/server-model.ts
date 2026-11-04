import {
  BEARER_PREFIX,
  ContentType,
  DEFAULT_MAX_TOKENS,
  type GenerateOptions,
  Header,
  HttpMethod,
  log,
  type Model,
} from "@gigsync/core";
import {
  MODEL_PROMPT_MAX,
  ModelGenerateReply,
  type ModelGenerateRequest,
  ServerModelStatus,
  type Session,
} from "@gigsync/protocol";
import { API_BASE } from "./api.js";

/**
 * GigSync's own model (ADR 0052): the prompt goes to GigSync's API with the owner's session, and the model on GigSync's
 * computer answers. Null whenever it cannot (signed out, no API, the server's model not set up or down, too slow), and
 * the app falls back to the phone's own model or lite mode.
 */

const GENERATE_PATH = "/v1/model/generate";
const STATUS_PATH = "/v1/model/status";
/** Long enough for the server's model at its slowest seen (about 2.5 s), short enough to fall back in time. */
const WAIT_MS = 4_000;
/** After a failure, the phone stops asking for this long, so a model that is down does not slow every message. */
const PAUSE_MS = 60_000;

export class ServerModel implements Model {
  private session: Session | undefined;
  private pausedUntil = 0;
  /** The API says a model is set up there; until it does, nothing is sent. */
  private on = false;

  /** `changed` is told when the model pauses, so the screens can say what answers now. */
  constructor(
    private readonly changed: () => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  /** Set by the app shell: the server's model is asked only while someone is signed in, once the API says it has one. */
  setSession(session: Session | undefined): void {
    this.session = session;
    this.on = false;
    if (session && API_BASE) void this.check(session);
  }

  /** Worth asking now: signed in, a model set up on the API, and no failure in the last minute. */
  get available(): boolean {
    return this.on && Boolean(API_BASE && this.session) && this.now() >= this.pausedUntil;
  }

  private async check(session: Session): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}${STATUS_PATH}`, {
        headers: { [Header.authorization]: `${BEARER_PREFIX}${session.token}` },
      });
      const status = res.ok ? ServerModelStatus.safeParse(await res.json()) : undefined;
      this.on = this.session === session && status?.success === true && status.data.on;
    } catch {
      this.on = false;
    }
    this.changed();
  }

  async generate(prompt: string, options?: GenerateOptions): Promise<string | null> {
    const session = this.session;
    if (!this.available || !session || prompt.length > MODEL_PROMPT_MAX) return null;
    const body: ModelGenerateRequest = {
      prompt,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(options?.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(options?.json ? { json: true } : {}),
      ...(options?.schema ? { schema: { ...options.schema } } : {}),
    };
    try {
      const res = await fetch(`${API_BASE}${GENERATE_PATH}`, {
        method: HttpMethod.post,
        headers: {
          [Header.authorization]: `${BEARER_PREFIX}${session.token}`,
          [Header.contentType]: ContentType.json,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WAIT_MS),
      });
      if (!res.ok) return this.failed(res.status);
      const reply = ModelGenerateReply.safeParse(await res.json());
      return reply.success ? reply.data.text : this.failed(res.status);
    } catch (err) {
      return this.failed(err instanceof Error ? err.name : typeof err);
    }
  }

  private failed(why: number | string): null {
    log.debug("server model: no answer, pausing", { why });
    this.pausedUntil = this.now() + PAUSE_MS;
    this.changed();
    return null;
  }
}
