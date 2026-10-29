import { describe, expect, it } from "vitest";
import { agent } from "../src/i18n/en/agent.js";
import { colleague } from "../src/i18n/en/colleague.js";
import { home } from "../src/i18n/en/home.js";
import { install } from "../src/i18n/en/install.js";
import { interview } from "../src/i18n/en/interview.js";
import { job } from "../src/i18n/en/job.js";
import { money } from "../src/i18n/en/money.js";
import { net } from "../src/i18n/en/net.js";
import { record } from "../src/i18n/en/record.js";
import { screens } from "../src/i18n/en/screens.js";
import { shell } from "../src/i18n/en/shell.js";
import { speech } from "../src/i18n/en/speech.js";
import { talk } from "../src/i18n/en/talk.js";
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
  colleague,
  talk,
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
