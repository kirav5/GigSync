import { type ModelInfo, ModelState, type ModelStatus } from "./definitions.js";

/**
 * WebLLM's load reports, as the app's status. A load is: the WebGPU library and tokenizer, then "Start to fetch
 * params", "Fetching param cache[i/n]" with `progress` the share of weight bytes in the cache (shards already there
 * count at once, which is how an interrupted download carries on), then "Loading model from cache[i/n]" onto the GPU
 * with `progress` counting again from 0, then "Finish loading". Only the fetch is a download; loading is the last step
 * of it for the owner, shown as fully downloaded.
 */

export const ENGINE = "webllm";

/** The report WebLLM's `initProgressCallback` receives (its `InitProgressReport`). */
export interface LoadReport {
  progress: number;
  text: string;
}

const LOADING = /^Loading model from cache/;
const FINISHED = /^Finish loading/;
const DONE = 1;

const clamp = (n: number) => (Number.isFinite(n) ? Math.min(Math.max(n, 0), DONE) : 0);

export function downloadingStatus(model: ModelInfo, progress: number): ModelStatus {
  const share = clamp(progress);
  return {
    available: false,
    engine: ENGINE,
    state: ModelState.downloading,
    progress: share,
    downloadedMb: Math.round(share * model.downloadMb),
    model,
  };
}

export const readyStatus = (model: ModelInfo): ModelStatus => ({
  available: true,
  engine: ENGINE,
  state: ModelState.available,
  model,
});

/** One report as a status: downloading with its share, or ready once WebLLM says it finished. */
export function progressStatus(report: LoadReport, model: ModelInfo): ModelStatus {
  if (FINISHED.test(report.text)) return readyStatus(model);
  if (LOADING.test(report.text)) return downloadingStatus(model, DONE);
  return downloadingStatus(model, report.progress);
}
