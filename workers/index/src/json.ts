// Small readers for outside JSON (Jetstream messages, relay and PDS replies, request bodies), so nothing is typed
// `any`: every field is checked before it is used.

type JsonObject = Record<string, unknown>;

export const isObject = (v: unknown): v is JsonObject => typeof v === "object" && v !== null && !Array.isArray(v);
export const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
export const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
export const obj = (v: unknown): JsonObject | undefined => (isObject(v) ? v : undefined);
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const strings = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === "string");

/** Parses JSON text, or returns undefined instead of throwing. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
