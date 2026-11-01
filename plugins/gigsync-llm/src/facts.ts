import type { DeviceFacts, GpuFacts } from "./gate.js";

/**
 * What the browser says about this device, for the gate (gate.ts). The adapter is asked once per page: it does not
 * change while the page is open, and asking costs a moment. Storage is read fresh each time, as it fills.
 */

const MB = 1024 * 1024;

/** The WebGPU and Device Memory APIs, which TypeScript's DOM types do not carry yet. */
interface GpuNavigator {
  gpu?: { requestAdapter(): Promise<GpuFacts | null> };
  deviceMemory?: number;
}

let adapter: Promise<GpuFacts | undefined> | undefined;

function gpuFacts(): Promise<GpuFacts | undefined> {
  adapter ??= (async () => {
    try {
      const gpu = (navigator as GpuNavigator).gpu;
      return (await gpu?.requestAdapter()) ?? undefined;
    } catch {
      return undefined;
    }
  })();
  return adapter;
}

async function freeStorageMb(): Promise<number | undefined> {
  try {
    const { quota, usage } = await navigator.storage.estimate();
    return quota === undefined ? undefined : Math.floor((quota - (usage ?? 0)) / MB);
  } catch {
    return undefined;
  }
}

export async function deviceFacts(): Promise<DeviceFacts> {
  const browser = typeof Worker !== "undefined" && typeof caches !== "undefined";
  const [gpu, storage] = await Promise.all([gpuFacts(), freeStorageMb()]);
  const memoryGb = (navigator as GpuNavigator).deviceMemory;
  return {
    browser,
    gpu,
    ...(memoryGb === undefined ? {} : { memoryGb }),
    ...(storage === undefined ? {} : { freeStorageMb: storage }),
  };
}

/** Asks the browser to keep the model when storage runs short; it may say no, and the download goes on either way. */
export async function keepStorage(): Promise<void> {
  try {
    await navigator.storage.persist();
  } catch {
    // Not offered here; the browser may evict the model later, and the app then offers it again.
  }
}
