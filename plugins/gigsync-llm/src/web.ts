import { WebPlugin } from "@capacitor/core";
import { infoOf, MODELS, type ModelSpec, specOfId } from "./catalog.js";
import {
  type GenerateOptions,
  type GenerateResult,
  type GigSyncLLMPlugin,
  type ModelInfo,
  type ModelOptions,
  ModelState,
  type ModelStatus,
  PROGRESS_EVENT,
} from "./definitions.js";
import { type Engine, WebLlmEngine } from "./engine.js";
import { deviceFacts, keepStorage } from "./facts.js";
import { judge, recommend } from "./gate.js";
import { downloadingStatus, ENGINE, progressStatus, readyStatus } from "./progress.js";
import { forgetReady, isReady, markReady, readyIds } from "./ready.js";
import { completionRequest } from "./request.js";

/**
 * The web engine (ADR 0040, LLD §9): a small open model, Qwen3.5 from WebLLM's prebuilt builds, run on the
 * phone's GPU through WebGPU in a Web Worker. Used by the web app and the app installed to the home screen; the
 * native apps have their own engines. Nothing a person types leaves the phone: the only network use is fetching the
 * model's files, once, after the owner agreed to it. No browser built-in model is used.
 */
export class GigSyncLLMWeb extends WebPlugin implements GigSyncLLMPlugin {
  private engineFor: Engine | undefined;
  /** The download under way, with its latest status. */
  private download: { id: string; status: ModelStatus; done: Promise<ModelStatus> } | undefined;

  /** Tests and the dev build pass their own; otherwise WebLLM, from `baseUrl` once one is given. */
  constructor(private readonly makeEngine: (baseUrl?: string) => Engine = (b) => new WebLlmEngine(b)) {
    super();
  }

  private engine(options: ModelOptions | undefined): Engine {
    this.engineFor ??= this.makeEngine(options?.baseUrl);
    return this.engineFor;
  }

  /** The size asked for; else the model on the phone or on its way to it, else the one this device suits best. */
  private async specFor(options: ModelOptions | undefined): Promise<ModelSpec> {
    if (options?.size) return MODELS[options.size];
    const onPhone =
      specOfId(this.download?.id) ??
      readyIds()
        .map(specOfId)
        .find((spec) => spec !== undefined);
    return onPhone ?? MODELS[recommend(await deviceFacts())];
  }

  /** The model this device would run for `spec`, or why it cannot run one; a downloaded one needs no gate. */
  private async pick(spec: ModelSpec): Promise<ModelInfo | ModelStatus> {
    const ready = Object.values(spec.ids).find(isReady);
    if (ready) return { id: ready, name: spec.name, size: spec.size, downloadMb: spec.downloadMb };
    const verdict = judge(await deviceFacts(), spec);
    if (!verdict.ok) return { available: false, engine: ENGINE, state: ModelState.unavailable, reason: verdict.reason };
    return infoOf(spec, verdict.variant);
  }

  async status(options?: ModelOptions): Promise<ModelStatus> {
    const spec = await this.specFor(options);
    // Asked before the gate: the download itself fills the storage the gate measures.
    if (this.download && Object.values(spec.ids).includes(this.download.id)) return this.download.status;
    const picked = await this.pick(spec);
    if (!("id" in picked)) return picked;
    if (isReady(picked.id)) return readyStatus(picked);
    return { available: false, engine: ENGINE, state: ModelState.downloadable, model: picked };
  }

  async prepare(options?: ModelOptions): Promise<ModelStatus> {
    const picked = await this.pick(await this.specFor(options));
    if (!("id" in picked) || isReady(picked.id)) return this.status(options);
    if (this.download?.id === picked.id) return this.download.done;
    const status = downloadingStatus(picked, 0);
    const done = this.fetch(picked, options);
    this.download = { id: picked.id, status, done };
    this.notifyListeners(PROGRESS_EVENT, status);
    return done;
  }

  private async fetch(model: ModelInfo, options: ModelOptions | undefined): Promise<ModelStatus> {
    await keepStorage();
    const engine = this.engine(options);
    try {
      await engine.load(model.id, (report) => {
        const status = progressStatus(report, model);
        if (this.download?.id === model.id) this.download.status = status;
        this.notifyListeners(PROGRESS_EVENT, status);
      });
      markReady(model.id);
      // One model on the phone at a time: a size chosen before is deleted once this one is in.
      await Promise.all(
        readyIds()
          .filter((id) => id !== model.id)
          .map((id) => this.drop(id, options)),
      );
    } catch {
      // The connection dropped or the GPU refused; the shards fetched so far stay in the cache for the next try.
    } finally {
      this.download = undefined;
    }
    const status = await this.status(options);
    this.notifyListeners(PROGRESS_EVENT, status);
    return status;
  }

  private async drop(id: string, options: ModelOptions | undefined): Promise<void> {
    forgetReady(id);
    try {
      await this.engine(options).remove(id);
    } catch {
      // Already gone from the cache.
    }
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const none: GenerateResult = { available: false, text: "", engine: ENGINE };
    const status = await this.status(options);
    const id = status.model?.id;
    if (!status.available || !id) return none;
    const engine = this.engine(options);
    try {
      if (engine.loaded !== id) {
        // The browser may have evicted the files; never download them again behind the owner's back.
        if (!(await engine.cached(id))) {
          forgetReady(id);
          return none;
        }
        await engine.load(id, () => {});
      }
      const started = performance.now();
      const text = await engine.complete(completionRequest(options, specOfId(id)?.thinks));
      return { available: true, text, engine: ENGINE, elapsedMs: Math.round(performance.now() - started) };
    } catch {
      return none;
    }
  }

  async remove(options?: ModelOptions): Promise<ModelStatus> {
    await Promise.all(readyIds().map((id) => this.drop(id, options)));
    return this.status(options);
  }
}
