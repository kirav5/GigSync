import { describe, expect, it } from "vitest";
import { agent } from "../src/i18n/en/agent.js";
import { ask } from "../src/i18n/en/ask.js";
import { cardflow } from "../src/i18n/en/cardflow.js";
import { chats } from "../src/i18n/en/chats.js";
import { contacts } from "../src/i18n/en/contacts.js";
import { estimate } from "../src/i18n/en/estimate.js";
import { explain } from "../src/i18n/en/explain.js";
import { findflow } from "../src/i18n/en/findflow.js";
import { home } from "../src/i18n/en/home.js";
import { idcheck } from "../src/i18n/en/idcheck.js";
import { install } from "../src/i18n/en/install.js";
import { interview } from "../src/i18n/en/interview.js";
import { job } from "../src/i18n/en/job.js";
import { jobcard } from "../src/i18n/en/jobcard.js";
import { jobs } from "../src/i18n/en/jobs.js";
import { kindAsk } from "../src/i18n/en/kind-ask.js";
import { landing } from "../src/i18n/en/landing.js";
import { ledger } from "../src/i18n/en/ledger.js";
import { me } from "../src/i18n/en/me.js";
import { memory } from "../src/i18n/en/memory.js";
import { mentor } from "../src/i18n/en/mentor.js";
import { money } from "../src/i18n/en/money.js";
import { moving } from "../src/i18n/en/moving.js";
import { need } from "../src/i18n/en/need.js";
import { net } from "../src/i18n/en/net.js";
import { page } from "../src/i18n/en/page.js";
import { phone } from "../src/i18n/en/phone.js";
import { qr } from "../src/i18n/en/qr.js";
import { record } from "../src/i18n/en/record.js";
import { records } from "../src/i18n/en/records.js";
import { schedule } from "../src/i18n/en/schedule.js";
import { screens } from "../src/i18n/en/screens.js";
import { shell } from "../src/i18n/en/shell.js";
import { speech } from "../src/i18n/en/speech.js";
import { start } from "../src/i18n/en/start.js";
import { tabs } from "../src/i18n/en/tabs.js";
import { talk } from "../src/i18n/en/talk.js";
import { terms } from "../src/i18n/en/terms.js";
import { worker } from "../src/i18n/en/worker.js";

/** Every English area file. Each language's index spreads them into one object, where a repeated key wins silently. */
const AREAS: Readonly<Record<string, object>> = {
  job,
  screens,
  worker,
  agent,
  shell,
  money,
  speech,
  interview,
  home,
  install,
  net,
  record,
  talk,
  need,
  memory,
  ask,
  landing,
  mentor,
  estimate,
  terms,
  explain,
  chats,
  qr,
  moving,
  page,
  phone,
  records,
  contacts,
  schedule,
  kindAsk,
  tabs,
  start,
  cardflow,
  jobcard,
  jobs,
  ledger,
  findflow,
  me,
  idcheck,
};

describe("string areas", () => {
  it("no key is in two area files", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];
    for (const [area, strings] of Object.entries(AREAS))
      for (const key of Object.keys(strings)) {
        const first = owner.get(key);
        if (first) clashes.push(`${key}: ${first} and ${area}`);
        else owner.set(key, area);
      }
    expect(clashes).toEqual([]);
  });
});
