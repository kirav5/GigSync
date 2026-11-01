import { describe, expect, it } from "vitest";
import { infoOf, MODEL, Variant } from "../src/catalog.js";
import { ModelState } from "../src/definitions.js";
import { ENGINE, progressStatus } from "../src/progress.js";

/** WebLLM's load reports, word for word as 0.2.86 writes them, as the app's status. */

const model = infoOf(MODEL, Variant.f16);
const report = (progress: number, text: string) => progressStatus({ progress, text }, model);

describe("status from WebLLM's progress", () => {
  it("is downloading from the first report, at 0", () => {
    expect(report(0, "Start to fetch params")).toEqual({
      available: false,
      engine: ENGINE,
      state: ModelState.downloading,
      progress: 0,
      downloadedMb: 0,
      model,
    });
  });

  it("carries the share of the weights fetched, and how many MB that is", () => {
    const text =
      "Fetching param cache[3/8]: 105MB fetched. 37% completed, 12 secs elapsed. It can take a while when we first visit this page to populate the cache. Later refreshes will become faster.";
    expect(report(0.375, text)).toMatchObject({
      state: ModelState.downloading,
      progress: 0.375,
      downloadedMb: Math.round(0.375 * model.downloadMb),
    });
  });

  it("counts loading onto the GPU as fully downloaded, though its own progress starts again at 0", () => {
    const status = report(0.125, "Loading model from cache[1/8]: 35MB loaded. 12% completed, 14 secs elapsed.");
    expect(status).toMatchObject({ state: ModelState.downloading, progress: 1, downloadedMb: model.downloadMb });
    expect(status.available).toBe(false);
  });

  it("is ready when WebLLM finished loading", () => {
    expect(report(1, "Finish loading on WebGPU - apple")).toEqual({
      available: true,
      engine: ENGINE,
      state: ModelState.available,
      model,
    });
  });

  it("keeps a broken share between 0 and 1", () => {
    expect(report(Number.NaN, "Fetching param cache[0/8]").progress).toBe(0);
    expect(report(1.5, "Fetching param cache[8/8]").progress).toBe(1);
    expect(report(-1, "Fetching param cache[0/8]").progress).toBe(0);
  });
});
