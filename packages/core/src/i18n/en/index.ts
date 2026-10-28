import { agent } from "./agent.js";
import { job } from "./job.js";
import { screens } from "./screens.js";
import { worker } from "./worker.js";

/**
 * English, and the shape every language must match: a key missing from another language is a type error, not an
 * English word on a Hindi screen. Placeholders are `{name}`, filled by `t()`. Plurals are `<key>.one` and
 * `<key>.other`, chosen by `plural()` with the language's own rules.
 */
export const en = { ...job, ...screens, ...worker, ...agent } as const;

export type MessageKey = keyof typeof en;
export type Strings = Readonly<Record<MessageKey, string>>;
