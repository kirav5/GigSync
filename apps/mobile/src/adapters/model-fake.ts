import { MODELS, type ModelOptions, ModelSize, ModelState, type ModelStatus, Unsupported } from "@gigsync/plugin-llm";
import type { ModelEngine } from "./model-engine.js";

/**
 * DEV ONLY: a scripted on-device model for the UI tests, as speech-fake.ts is for voice (headless browsers have no
 * GPU to trust). Active when localStorage["gigsync-fake-model"] holds JSON `{ "mode": … }`:
 *   "capable":   the model can be downloaded; a download takes STEPS × STEP_MS, and a reload part-way keeps what
 *                arrived (localStorage["gigsync-fake-model-progress"]), as WebLLM's cache keeps its shards
 *   "incapable": this phone has no WebGPU, so nothing is offered
 *   "slow":      capable, and every answer takes longer than the router waits, for the speed guard
 * A finished download is kept in localStorage["gigsync-fake-model-ready"]; each download started is logged to
 * localStorage["gigsync-fake-model-fetches"]. Answers are empty, so the word lists still route. model-engine.ts loads
 * this module only under import.meta.env.DEV, so release builds never contain it.
 */
const MODE_KEY = "gigsync-fake-model";
const READY_KEY = "gigsync-fake-model-ready";
const PROGRESS_KEY = "gigsync-fake-model-progress";
const FETCHES_KEY = "gigsync-fake-model-fetches";
const FakeMode = { capable: "capable", incapable: "incapable", slow: "slow" } as const;
type FakeMode = (typeof FakeMode)[keyof typeof FakeMode];
const MODES: ReadonlySet<string> = new Set(Object.values(FakeMode));
const isMode = (v: unknown): v is FakeMode => typeof v === "string" && MODES.has(v);
const ENGINE = "fake";
const STEPS = 10;
const STEP_MS = 250;
/** Past MODEL_ROUTE_TIMEOUT_MS, as the "slow" phone reports its answers. */
const SLOW_ANSWER_MS = 6000;
const QUICK_ANSWER_MS = 300;

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

function modeOf(): FakeMode | undefined {
  try {
    const raw: unknown = JSON.parse(read(MODE_KEY) ?? "null");
    const mode = raw && typeof raw === "object" && "mode" in raw ? raw.mode : undefined;
    return isMode(mode) ? mode : undefined;
  } catch {
    return undefined;
  }
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

const infoFor = (o: ModelOptions) => {
  const spec = MODELS[o.size ?? ModelSize.small];
  return { id: spec.ids.f16, name: spec.name, downloadMb: spec.downloadMb };
};
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
    async generate() {
      const elapsedMs = mode === FakeMode.slow ? SLOW_ANSWER_MS : QUICK_ANSWER_MS;
      return { available: read(READY_KEY) !== null, text: "", engine: ENGINE, elapsedMs };
    },
    async remove(o) {
      write(READY_KEY, null);
      write(PROGRESS_KEY, null);
      return status(o);
    },
  };
}
