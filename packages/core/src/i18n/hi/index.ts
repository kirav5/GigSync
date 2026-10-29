import type { Strings } from "../en/index.js";
import { agent } from "./agent.js";
import { ask } from "./ask.js";
import { estimate } from "./estimate.js";
import { home } from "./home.js";
import { install } from "./install.js";
import { interview } from "./interview.js";
import { job } from "./job.js";
import { landing } from "./landing.js";
import { memory } from "./memory.js";
import { mentor } from "./mentor.js";
import { money } from "./money.js";
import { need } from "./need.js";
import { net } from "./net.js";
import { record } from "./record.js";
import { screens } from "./screens.js";
import { shell } from "./shell.js";
import { speech } from "./speech.js";
import { talk } from "./talk.js";
import { worker } from "./worker.js";

/** Hindi. Written by the team, to be checked by a native-speaking organiser before the pilot (docs/gigsync/i18n-review.md). */
export const hi: Strings = {
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
  ...talk,
  ...need,
  ...memory,
  ...ask,
  ...landing,
  ...mentor,
  ...estimate,
};
