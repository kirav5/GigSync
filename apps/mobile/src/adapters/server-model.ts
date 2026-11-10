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
/** After failures in a row, the phone stops asking for this long, so a model that is down does not slow every message. */
const PAUSE_MS = 60_000;
/** A timer may fire a moment early: the screens are told the pause is over just after it is. */
const PAUSE_END_SLACK_MS = 100;
/** One slow answer is not a model that is down: it is usually the model loading, and the next call is fast. */
const FAILURES_TO_PAUSE = 2;

export class ServerModel implements Model {
  private session: Session | undefined;
  private pausedUntil = 0;
  private failures = 0;
  /** The API says a model is set up there; until it does, nothing is sent. */
  private on = false;
  /** The question to the API about its model, while it is on the way. */
  private checking: Promise<void> | undefined;

  /** `changed` is told when the model pauses and when the pause ends, so the screens can say what answers now. */
  constructor(
    private readonly changed: () => void = () => {},
    private readonly now: () => number = Date.now,
  ) {}

  /** Set by the app shell: the server's model is asked only while someone is signed in, once the API says it has one. */
  setSession(session: Session | undefined): void {
    this.session = session;
    this.on = false;
    this.checking = session && API_BASE ? this.check(session) : undefined;
  }

  /**
   * Resolves once the API has said whether it has a model, or at once when it has. A worker who answers the first
   * question seconds after signing up is otherwise read as if there were no model at all.
   */
  async ready(): Promise<void> {
    await this.checking;
  }

  /** Worth asking now: signed in, a model set up on the API, and no failure in the last minute. */
  get available(): boolean {
    return this.on && Boolean(API_BASE && this.session) && this.now() >= this.pausedUntil;
  }

  /** Set up and signed in, but not asked for now: it failed in the last minute, and is tried again after it. */
  get paused(): boolean {
    return this.on && Boolean(API_BASE && this.session) && this.now() < this.pausedUntil;
  }

  private async check(session: Session): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}${STATUS_PATH}`, {
        headers: { [Header.authorization]: `${BEARER_PREFIX}${session.token}` },
        signal: AbortSignal.timeout(WAIT_MS),
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
      ...(options?.purpose ? { purpose: options.purpose } : {}),
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
      if (!reply.success) return this.failed(res.status);
      this.failures = 0;
      // How GigSync's computer did, beside the phone's own timing (model.ts): for tuning, never the words.
      if (reply.data.usage) log.info("server model usage", { purpose: options?.purpose, ...reply.data.usage });
      return reply.data.text;
    } catch (err) {
      return this.failed(err instanceof Error ? err.name : typeof err);
    }
  }

  private failed(why: number | string): null {
    this.failures += 1;
    const pausing = this.failures >= FAILURES_TO_PAUSE;
    log.warn("server model gave no answer", { why, failures: this.failures, pausing });
    if (pausing) {
      this.pausedUntil = this.now() + PAUSE_MS;
      this.failures = 0;
      this.changed();
      // The pause ends by the clock alone: the screens are told then too, so typing comes back by itself.
      setTimeout(this.changed, PAUSE_MS + PAUSE_END_SLACK_MS);
    }
    return null;
  }
}
