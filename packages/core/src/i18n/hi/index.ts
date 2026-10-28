import type { Strings } from "../en/index.js";
import { agent } from "./agent.js";
import { job } from "./job.js";
import { screens } from "./screens.js";
import { worker } from "./worker.js";

/** Hindi. Written by the team, to be checked by a native-speaking organiser before the pilot (docs/gigsync/i18n-review.md). */
export const hi: Strings = { ...job, ...screens, ...worker, ...agent };
