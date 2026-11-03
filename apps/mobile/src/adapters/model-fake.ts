import { MODEL, type ModelOptions, ModelState, type ModelStatus, Unsupported } from "@gigsync/plugin-llm";
import type { ModelEngine } from "./model-engine.js";

/**
 * DEV ONLY: a scripted on-device model for the UI tests, as speech-fake.ts is for voice (headless browsers have no
 * GPU to trust). Active when localStorage["gigsync-fake-model"] holds JSON `{ "mode": … }`:
 *   "capable":   the model can be downloaded; a download takes STEPS × STEP_MS, and a reload part-way keeps what
 *                arrived (localStorage["gigsync-fake-model-progress"]), as WebLLM's cache keeps its shards
 *   "incapable": this phone has no WebGPU, so nothing is offered
 * A finished download is kept in localStorage["gigsync-fake-model-ready"]; each download started is logged to
 * localStorage["gigsync-fake-model-fetches"]. Routing answers (JSON) are empty, so the next reader routes, unless the
 * JSON also holds `routes`, the reply to give for a message (`{ "mode": …, "routes": { "<message>": "<reply>" } }`),
 * and `delayMs`, how long a routing answer takes, for the chat's "thinking" to show. Any other answer is FREE_ANSWER,
 * as WebLLM gives Qwen3.5's. model-engine.ts loads this module only under
 * import.meta.env.DEV, so release builds never contain it.
 */
const MODE_KEY = "gigsync-fake-model";
const READY_KEY = "gigsync-fake-model-ready";
const PROGRESS_KEY = "gigsync-fake-model-progress";
const FETCHES_KEY = "gigsync-fake-model-fetches";
const FakeMode = { capable: "capable", incapable: "incapable" } as const;
type FakeMode = (typeof FakeMode)[keyof typeof FakeMode];
const MODES: ReadonlySet<string> = new Set(Object.values(FakeMode));
const isMode = (v: unknown): v is FakeMode => typeof v === "string" && MODES.has(v);
const ENGINE = "fake";
const STEPS = 10;
const STEP_MS = 250;
const ANSWER_MS = 300;
/** A free answer as WebLLM 0.2.86 returns one with thinking off: its empty thinking block first, then Markdown. */
const FREE_ANSWER = "<think>\n\n</think>\n\n**Hey** there! How can I help you?";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // A test that reads nothing fails on its own.
  }
}

/** What the test asked of the fake: its mode, and any scripted routing replies and their delay. */
function script(): Record<string, unknown> {
  try {
    const raw: unknown = JSON.parse(read(MODE_KEY) ?? "null");
    return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function modeOf(): FakeMode | undefined {
  const { mode } = script();
  return isMode(mode) ? mode : undefined;
}

const MESSAGE_LINE = "Message: ";

/** The scripted routing reply for the message a routing prompt ends with, or empty when the test gave none. */
async function routeReply(prompt: string): Promise<string> {
  const { routes, delayMs } = script();
  if (typeof delayMs === "number") await wait(delayMs);
  const line = prompt
    .split("\n")
    .reverse()
    .find((l) => l.startsWith(MESSAGE_LINE));
  if (!line || !routes || typeof routes !== "object") return "";
  const said: unknown = JSON.parse(line.slice(MESSAGE_LINE.length));
  const reply = typeof said === "string" ? (routes as Record<string, unknown>)[said] : undefined;
  return typeof reply === "string" ? reply : "";
}

/** Adds a download to the list a test reads. */
function logFetch(id: string): void {
  try {
    const list: unknown = JSON.parse(read(FETCHES_KEY) ?? "[]");
    write(FETCHES_KEY, JSON.stringify([...(Array.isArray(list) ? list : []), id]));
  } catch {
    write(FETCHES_KEY, JSON.stringify([id]));
  }
}

const infoFor = (_o: ModelOptions) => ({ id: MODEL.ids.f16, name: MODEL.name, downloadMb: MODEL.downloadMb });
/** Steps of an earlier download that arrived before the page went away. */
const stepsSoFar = () => Number(read(PROGRESS_KEY) ?? 0) || 0;
const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

function downloading(o: ModelOptions, progress: number): ModelStatus {
  const model = infoFor(o);
  const downloadedMb = Math.round(progress * model.downloadMb);
  return { available: false, engine: ENGINE, state: ModelState.downloading, progress, downloadedMb, model };
}

/** The fake engine, or undefined when no test asked for one. */
export function fakeModel(): ModelEngine | undefined {
  const mode = modeOf();
  if (!mode) return undefined;
  let fetching: Promise<ModelStatus> | undefined;
  let now: ModelStatus | undefined;
  const status = async (o: ModelOptions): Promise<ModelStatus> => {
    if (mode === FakeMode.incapable) {
      return { available: false, engine: ENGINE, state: ModelState.unavailable, reason: Unsupported.noWebGpu };
    }
    if (now) return now;
    const ready = read(READY_KEY) === infoFor(o).id;
    const state = ready ? ModelState.available : ModelState.downloadable;
    return { available: ready, engine: ENGINE, state, model: infoFor(o) };
  };
  async function fetchAll(o: ModelOptions, onProgress: (s: ModelStatus) => void): Promise<ModelStatus> {
    logFetch(infoFor(o).id);
    for (let step = stepsSoFar(); step < STEPS; step++) {
      now = downloading(o, step / STEPS);
      onProgress(now);
      await wait(STEP_MS);
      write(PROGRESS_KEY, String(step + 1));
    }
    write(READY_KEY, infoFor(o).id);
    write(PROGRESS_KEY, null);
    now = undefined;
    return status(o);
  }
  return {
    status,
    async prepare(o, onProgress) {
      if ((await status(o)).state !== ModelState.downloadable) return status(o);
      fetching ??= fetchAll(o, onProgress).finally(() => {
        fetching = undefined;
      });
      return fetching;
    },
    async generate(o) {
      return {
        available: read(READY_KEY) !== null,
        text: o.json ? await routeReply(o.prompt) : FREE_ANSWER,
        engine: ENGINE,
        elapsedMs: ANSWER_MS,
      };
    },
    async remove(o) {
      write(READY_KEY, null);
      write(PROGRESS_KEY, null);
      return status(o);
    },
  };
}
