import type { AppConfig, ChatCompletionRequestNonStreaming, WebWorkerMLCEngine } from "@mlc-ai/web-llm";
import type { LoadReport } from "./progress.js";
import { appConfigFor } from "./request.js";

/**
 * The WebLLM side of the web engine: one engine in a Web Worker, with at most one model loaded. WebLLM (about 6 MB of
 * JavaScript) is imported only on the first download or answer, so the app's first load never carries it.
 */
export interface Engine {
  /** Downloads what is missing from the cache and loads the model onto the GPU. */
  load(id: string, onProgress: (report: LoadReport) => void): Promise<void>;
  /** Whether every file of the model is in the cache, so loading it downloads nothing. */
  cached(id: string): Promise<boolean>;
  complete(request: ChatCompletionRequestNonStreaming): Promise<string>;
  /** Unloads it if loaded and deletes its files from the cache. */
  remove(id: string): Promise<void>;
  readonly loaded: string | undefined;
}

const webllm = () => import("@mlc-ai/web-llm");

export class WebLlmEngine implements Engine {
  private worker: Promise<WebWorkerMLCEngine> | undefined;
  private config: Promise<AppConfig> | undefined;
  private current: string | undefined;

  constructor(private readonly baseUrl: string | undefined) {}

  get loaded(): string | undefined {
    return this.current;
  }

  private appConfig(): Promise<AppConfig> {
    this.config ??= webllm().then((w) => appConfigFor(w.prebuiltAppConfig, this.baseUrl));
    return this.config;
  }

  private engine(): Promise<WebWorkerMLCEngine> {
    this.worker ??= Promise.all([webllm(), this.appConfig()]).then(
      ([w, appConfig]) =>
        new w.WebWorkerMLCEngine(new Worker(new URL("./worker.js", import.meta.url), { type: "module" }), {
          appConfig,
        }),
    );
    return this.worker;
  }

  async load(id: string, onProgress: (report: LoadReport) => void): Promise<void> {
    if (this.current === id) return;
    const engine = await this.engine();
    engine.setInitProgressCallback(onProgress);
    this.current = undefined;
    await engine.reload(id);
    this.current = id;
  }

  async cached(id: string): Promise<boolean> {
    const [w, appConfig] = await Promise.all([webllm(), this.appConfig()]);
    return w.hasModelInCache(id, appConfig);
  }

  async complete(request: ChatCompletionRequestNonStreaming): Promise<string> {
    const reply = await (await this.engine()).chat.completions.create(request);
    return reply.choices[0]?.message.content ?? "";
  }

  async remove(id: string): Promise<void> {
    if (this.current === id) {
      await (await this.engine()).unload();
      this.current = undefined;
    }
    const [w, appConfig] = await Promise.all([webllm(), this.appConfig()]);
    await w.deleteModelAllInfoInCache(id, appConfig);
  }
}
