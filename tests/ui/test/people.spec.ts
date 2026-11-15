import { type MessageKey, type Params, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { foundWorkers, pickOnly, tellNeed } from "./findChat.js";
import { newChat, open, shoot, textOf } from "./helpers.js";
import { unlistCards } from "./journey.js";
import { signedJob } from "./signed-job.js";

/**
 * People you know, for both sides, on two phones against the real API and mailbox: a worker and a household who
 * signed a job see each other there. Blocking hides someone everywhere the blocker looks and stops what they send
 * (a household's Find no longer lists the worker; a worker's phone drops the household's request); Unblock, from the
 * Blocked list on the same page, lets them back.
 */

const en = Lang.enum.en;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const FOLDER = "people";
const NEED = {
  trade: "carpenter",
  area: "Jayanagar",
  need: "Need a carpenter",
  when: "when.today",
  budget: "750",
} as const;
/** Long enough for several of the app's 2 s syncs on both phones: a request that was coming would be here by then. */
const DROPPED_MS = 12_000;

let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function pages(browser: { newContext: () => Promise<BrowserContext> }): Promise<[Page, Page]> {
  contexts = [await browser.newContext(), await browser.newContext()];
  return (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
}

/** Someone's row among the people the owner knows: a button by their name. */
const knownRow = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** Someone's Unblock, in the Blocked list. */
const unblockButton = (page: Page, name: string) =>
  page.getByRole("button", { name: `${say("me.unblock")} ${name}`, exact: true });

/** On People you know: taps them, Block, then confirms "Block Name?". */
async function block(page: Page, name: string, shots: Record<string, Page>) {
  await open(page, "me.people");
  await knownRow(page, name).click();
  await page
    .getByRole("dialog", { name })
    .getByRole("button", { name: say("mentor.block"), exact: true })
    .click();
  const confirm = page.getByRole("dialog", { name: say("me.block_title", { name }) });
  await expect(confirm).toContainText(say("me.block_about", { name }));
  await shoot("block-confirm", shots, FOLDER);
  await confirm.getByRole("button", { name: say("mentor.block"), exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(knownRow(page, name)).toHaveCount(0);
  await expect(page.getByText(say("me.blocked"), { exact: true })).toBeVisible();
  await expect(unblockButton(page, name)).toBeVisible();
}

/** On People you know: Unblock beside them, then confirms "Unblock Name?"; they are among the people known again. */
async function unblock(page: Page, name: string) {
  await open(page, "me.people");
  await unblockButton(page, name).click();
  const confirm = page.getByRole("dialog", { name: say("me.unblock_title", { name }) });
  await confirm.getByRole("button", { name: say("me.unblock"), exact: true }).click();
  await expect(confirm).toBeHidden();
  await expect(unblockButton(page, name)).toHaveCount(0);
  await expect(knownRow(page, name)).toBeVisible();
}

/** A household's new Find chat, told the carpenter need, until the search answers: workers to pick, or nobody. */
async function searchAgain(home: Page) {
  await newChat(home);
  await tellNeed({ page: home, lang: en }, NEED);
  await expect(foundWorkers(home, en).or(home.getByText(textOf(en, "need.nobody")))).toBeVisible();
}

/** The household asks the worker again from People you know: a chat to him alone, told the need and sent. */
async function askAgain(home: Page, worker: string) {
  await open(home, "me.people");
  await knownRow(home, worker).click();
  await home
    .getByRole("dialog", { name: worker })
    .getByRole("button", { name: say("me.ask_again"), exact: true })
    .click();
  await expect(home.getByRole("log")).toContainText(say("need.start_to", { name: worker }));
  await tellNeed({ page: home, lang: en }, NEED);
}

/** His agent got the request: it asks what is wrong, which only the household can answer. */
const answerForm = (home: Page) => home.getByRole("form", { name: say("a11y.answer") });

test("a household blocks the worker it hired: gone from Find until she unblocks him", async ({ browser }) => {
  const [worker, home] = await pages(browser);
  const names = await signedJob(worker, home, "hb", FOLDER);
  const shots = { worker, household: home };
  // Both see each other among the people they know.
  await open(home, "me.people");
  await expect(knownRow(home, names.worker)).toBeVisible();
  await open(worker, "me.people");
  await expect(knownRow(worker, names.household)).toBeVisible();
  await shoot("known", shots, FOLDER);

  await block(home, names.worker, shots);
  await shoot("blocked", shots, FOLDER);
  await searchAgain(home);
  await expect(home.getByLabel(say("a11y.worker", { name: names.worker }))).toHaveCount(0);
  await shoot("find-without-him", shots, FOLDER);

  await unblock(home, names.worker);
  await shoot("unblocked", shots, FOLDER);
  await newChat(home);
  await tellNeed({ page: home, lang: en }, NEED);
  await pickOnly({ page: home, lang: en }, names.worker);
  await shoot("find-with-him", shots, FOLDER);
});

test("a worker blocks a household: her request never reaches him until he unblocks her", async ({ browser }) => {
  const [worker, home] = await pages(browser);
  const names = await signedJob(worker, home, "wb", FOLDER);
  const shots = { worker, household: home };

  await block(worker, names.household, shots);
  await askAgain(home, names.worker);
  // His phone drops it: his agent never answers, so nothing comes back to ask her.
  await home.waitForTimeout(DROPPED_MS);
  await expect(answerForm(home)).toHaveCount(0);
  await shoot("request-dropped", shots, FOLDER);

  await unblock(worker, names.household);
  await askAgain(home, names.worker);
  await expect(answerForm(home)).toBeVisible();
  await shoot("request-reaches", shots, FOLDER);
});
