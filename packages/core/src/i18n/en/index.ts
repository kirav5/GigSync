import { agent } from "./agent.js";
import { colleague } from "./colleague.js";
import { home } from "./home.js";
import { install } from "./install.js";
import { interview } from "./interview.js";
import { job } from "./job.js";
import { money } from "./money.js";
import { need } from "./need.js";
import { net } from "./net.js";
import { record } from "./record.js";
import { screens } from "./screens.js";
import { shell } from "./shell.js";
import { speech } from "./speech.js";
import { talk } from "./talk.js";
import { worker } from "./worker.js";

/**
 * English, and the shape every language must match: a key missing from another language is a type error, not an
 * English word on a Hindi screen. Placeholders are `{name}`, filled by `t()`. Plurals are `<key>.one` and
 * `<key>.other`, chosen by `plural()` with the language's own rules. Each area file owns its keys; no key may be in two
 * of them, or the spread below lets one win silently (test/i18n-areas.test.ts).
 */
export const en = {
  ...job,
  ...screens,
  ...worker,
  ...agent,
  ...shell,
  ...money,
  ...speech,
  ...interview,
  ...home,
  ...install,
  ...net,
  ...record,
  ...colleague,
  ...talk,
  ...need,
} as const;

export type MessageKey = keyof typeof en;
export type Strings = Readonly<Record<MessageKey, string>>;
