/**
 * Which models finished downloading on this device, kept in localStorage so `status()` can answer without loading
 * WebLLM. Before a model is loaded from it, the engine checks the cache really has it (the browser may evict it).
 */
const READY_KEY = "gigsync-webllm-ready";

export function readyIds(): string[] {
  try {
    const ids: unknown = JSON.parse(localStorage.getItem(READY_KEY) ?? "[]");
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function save(ids: readonly string[]): void {
  try {
    localStorage.setItem(READY_KEY, JSON.stringify(ids));
  } catch {
    // Private mode: the model is offered again next time, and WebLLM's cache makes that quick.
  }
}

export const isReady = (id: string) => readyIds().includes(id);
export const markReady = (id: string) => save([...readyIds().filter((r) => r !== id), id]);
export const forgetReady = (id: string) => save(readyIds().filter((r) => r !== id));
