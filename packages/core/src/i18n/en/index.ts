import { address } from "./address.js";
import { agent } from "./agent.js";
import { arrangement } from "./arrangement.js";
import { ask } from "./ask.js";
import { bargain } from "./bargain.js";
import { cardflow } from "./cardflow.js";
import { category } from "./category.js";
import { chats } from "./chats.js";
import { contacts } from "./contacts.js";
import { drivers } from "./drivers.js";
import { estimate } from "./estimate.js";
import { explain } from "./explain.js";
import { findflow } from "./findflow.js";
import { group } from "./group.js";
import { home } from "./home.js";
import { install } from "./install.js";
import { interview } from "./interview.js";
import { job } from "./job.js";
import { jobcard } from "./jobcard.js";
import { jobs } from "./jobs.js";
import { kindAsk } from "./kind-ask.js";
import { landing } from "./landing.js";
import { ledger } from "./ledger.js";
import { me } from "./me.js";
import { memory } from "./memory.js";
import { mentor } from "./mentor.js";
import { model } from "./model.js";
import { money } from "./money.js";
import { moving } from "./moving.js";
import { need } from "./need.js";
import { net } from "./net.js";
import { page } from "./page.js";
import { phone } from "./phone.js";
import { progress } from "./progress.js";
import { qr } from "./qr.js";
import { record } from "./record.js";
import { records } from "./records.js";
import { schedule } from "./schedule.js";
import { screens } from "./screens.js";
import { shell } from "./shell.js";
import { skill } from "./skill.js";
import { speech } from "./speech.js";
import { start } from "./start.js";
import { tabs } from "./tabs.js";
import { talk } from "./talk.js";
import { terms } from "./terms.js";
import { worker } from "./worker.js";

/**
 * English, and the shape every language must match: a key missing from another language is a type error, not an
 * English word on a Hindi screen. Placeholders are `{name}`, filled by `t()`. Plurals are `<key>.one` and
 * `<key>.other`, chosen by `plural()` with the language's own rules. Each area file owns its keys; no key may be in two
 * of them, or the spread below lets one win silently (test/i18n-areas.test.ts).
 */
export const en = {
  ...job,
  ...category,
  ...group,
  ...screens,
  ...worker,
  ...model,
  ...agent,
  ...shell,
  ...money,
  ...speech,
  ...interview,
  ...home,
  ...install,
  ...net,
  ...record,
  ...records,
  ...talk,
  ...schedule,
  ...progress,
  ...need,
  ...memory,
  ...ask,
  ...landing,
  ...mentor,
  ...estimate,
  ...drivers,
  ...arrangement,
  ...skill,
  ...kindAsk,
  ...address,
  ...bargain,
  ...terms,
  ...explain,
  ...chats,
  ...moving,
  ...qr,
  ...page,
  ...phone,
  ...contacts,
  ...tabs,
  ...start,
  ...cardflow,
  ...jobcard,
  ...jobs,
  ...ledger,
  ...findflow,
  ...me,
} as const;

export type MessageKey = keyof typeof en;
export type Strings = Readonly<Record<MessageKey, string>>;
