import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

/**
 * The settings in a gitignored env file (`workers/api/.dev.vars`, `.env.local`), read into memory. Values are never
 * printed: callers say only whether a key is set.
 */
export function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const parsed = parseEnv(readFileSync(path, "utf8"));
  return Object.fromEntries(Object.entries(parsed).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Throws naming the missing keys, never their values. */
export function requireKeys<K extends string>(env: Record<string, string>, keys: readonly K[]): Record<K, string> {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length > 0) throw new Error(`missing settings: ${missing.join(", ")}`);
  return Object.fromEntries(keys.map((k) => [k, env[k] as string])) as Record<K, string>;
}
