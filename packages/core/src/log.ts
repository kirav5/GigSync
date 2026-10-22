/**
 * One logger for the app and every Worker. Local runs log everything, private data included, so a bug can be
 * followed end to end. Everywhere else, values wrapped in pii() print as "[redacted]" and debug lines are dropped.
 * Plain TS: console exists on Workers, in browsers and in the webviews.
 */

export const LogLevel = { debug: "debug", info: "info", warn: "warn", error: "error" } as const;
export type Level = (typeof LogLevel)[keyof typeof LogLevel];
export type Fields = Record<string, unknown>;

export const LogFormat = { json: "json", pretty: "pretty" } as const;
type Format = (typeof LogFormat)[keyof typeof LogFormat];

/** The only environment in which private values may print. */
export const LOCAL_ENVIRONMENT = "local";
/** What a pii() value prints as everywhere else. */
export const REDACTED = "[redacted]";

const RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const isLevel = (v: string | undefined): v is Level => v !== undefined && v in RANK;

interface Config {
  level: Level;
  /** Print pii() values as they are. Only ever true when the environment is "local". */
  pii: boolean;
  /** json: one line per event, for Workers Logs. pretty: a label plus an object, for a browser console. */
  format: Format;
}

let config: Config = { level: LogLevel.info, pii: false, format: LogFormat.json };

export interface LogSettings {
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  LOG_PII?: string | boolean;
  format?: Format;
}

/**
 * Sets the logger from environment settings. Fails safe: an unknown level means info, and private data shows only
 * when LOG_PII is exactly true AND the environment is local, so a copied config can never leak it from a deployment.
 */
export function configureLog(s: LogSettings): void {
  const level = isLevel(s.LOG_LEVEL) ? s.LOG_LEVEL : LogLevel.info;
  const pii = (s.LOG_PII === true || s.LOG_PII === String(true)) && s.ENVIRONMENT === LOCAL_ENVIRONMENT;
  config = { level, pii, format: s.format ?? config.format };
}

export function logEnabled(level: Level): boolean {
  return RANK[level] >= RANK[config.level];
}

class Private {
  constructor(readonly value: unknown) {}
}

/** Marks a value as private: phone numbers, message text, codes, tokens, names, places. Shown only in local logs. */
export function pii(value: unknown): Private {
  return new Private(value);
}

/** Hides pii() values (unless local), flattens errors, and prints bindings and class instances as their type. */
function replacer(_key: string, v: unknown): unknown {
  if (v instanceof Private) return config.pii ? v.value : REDACTED;
  if (v instanceof Error) return { name: v.name, message: v.message };
  // Bindings and class instances (D1Database, a Durable Object stub) print as their type, not their insides.
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return `[${v.constructor?.name ?? "object"}]`;
  }
  return v;
}

/** console.log for info, so Workers Logs and browsers show it at their default level. */
const WRITERS: Record<Level, (...args: unknown[]) => void> = {
  debug: (...a) => console.debug(...a),
  info: (...a) => console.log(...a),
  warn: (...a) => console.warn(...a),
  error: (...a) => console.error(...a),
};

function emit(level: Level, msg: string, fields: Fields = {}): void {
  if (!logEnabled(level)) return;
  const out = WRITERS[level];
  // JSON (Workers) serializes once; pretty (browser) needs a plain object back for the console to expand.
  if (config.format === LogFormat.json) out(JSON.stringify({ level, msg, ...fields }, replacer));
  else out(`[${level}] ${msg}`, JSON.parse(JSON.stringify(fields, replacer)));
}

export const log: Record<Level, (msg: string, fields?: Fields) => void> = {
  debug: (msg, fields) => emit(LogLevel.debug, msg, fields),
  info: (msg, fields) => emit(LogLevel.info, msg, fields),
  warn: (msg, fields) => emit(LogLevel.warn, msg, fields),
  error: (msg, fields) => emit(LogLevel.error, msg, fields),
};

/**
 * Wraps an async function so each call logs its name, arguments, result and duration at debug level. Arguments and
 * results are private by default; local logs show them, others never reach debug. Failures log and rethrow.
 */
export function traced<A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    if (!logEnabled(LogLevel.debug)) return fn(...args);
    const start = Date.now();
    try {
      const result = await fn(...args);
      emit(LogLevel.debug, name, { args: pii(args), result: pii(result), ms: Date.now() - start });
      return result;
    } catch (err) {
      emit(LogLevel.debug, `${name} failed`, { args: pii(args), error: err, ms: Date.now() - start });
      throw err;
    }
  };
}
