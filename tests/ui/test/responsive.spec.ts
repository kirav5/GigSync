import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { unlistCards } from "./journey.js";
import { signedJob } from "./signed-job.js";

/**
 * A tap always shows it was heard: a job's moves hold together with a ring on the one tapped until the job is read
 * back, a move that failed says so, a note says it is sending, every press answers the thumb, and Reduce Motion takes
 * the movement away and leaves the feedback.
 */

const { en } = Lang.enum;
const FOLDER = "responsive";
const say = (key: MessageKey) => t(en, key);
const button = (scope: Locator, key: MessageKey) => scope.getByRole("button", { name: say(key), exact: true });
const jobWith = (page: Page, name: string) => page.getByRole("article", { name: t(en, "a11y.job_with", { name }) });
/** The API: holding it holds a move, as a slow network would. */
const API_CALLS = "**/v1/**";
const IDENTITY = "matrix(1, 0, 0, 1, 0, 0)";

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

/** Holds this phone's calls to the API until the returned function lets them go. */
async function holdCalls(page: Page) {
  let letGo = () => {};
  const held = new Promise<void>((resolve) => {
    letGo = resolve;
  });
  await page.route(API_CALLS, async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  return async () => {
    letGo();
    await page.unroute(API_CALLS);
  };
}

test("a tap on a job's move holds its card and rings that button until the job has moved on", async ({ browser }) => {
  const [workerPage, householdPage] = await pages(browser);
  const names = await signedJob(workerPage, householdPage, "hold", FOLDER);
  const job = jobWith(workerPage, names.household);
  const step = button(job, "update.on_my_way");
  await expect(step).toBeEnabled();
  const working = job.getByRole("status").filter({ hasText: say("busy.working") });

  const release = await holdCalls(workerPage);
  await step.click();
  await expect(step).toHaveAttribute("aria-busy", "true");
  await expect(step).toBeDisabled();
  await expect(button(job, "restored.cancel")).toBeDisabled();
  await expect(button(job, "restored.cancel")).not.toHaveAttribute("aria-busy", "true");
  await expect(working).toBeVisible();

  await release();
  await expect(button(job, "job.start_work")).toBeEnabled();
  await expect(step).toHaveCount(0);
  await expect(working).toHaveCount(0);
});

test("a move that failed says so and can be tapped again, and a note says it is sending", async ({ browser }) => {
  const [workerPage, householdPage] = await pages(browser);
  const names = await signedJob(workerPage, householdPage, "fail", FOLDER);
  const job = jobWith(workerPage, names.household);
  await expect(button(job, "update.on_my_way")).toBeEnabled();

  // A phone whose storage is full cannot keep the move: the card lets go and says so.
  const restore = await workerPage.evaluateHandle(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException("no room", "QuotaExceededError");
    };
    return () => {
      Storage.prototype.setItem = real;
    };
  });
  await button(job, "update.on_my_way").click();
  await expect(job.getByText(say("error.generic"))).toBeVisible();
  await expect(button(job, "update.on_my_way")).toBeEnabled();
  await restore.evaluate((put) => put());

  // No network is no failure: the move is kept and goes out later, so the card moves on.
  await workerPage.route(API_CALLS, (route) => route.abort());
  await button(job, "update.on_my_way").click();
  await expect(button(job, "job.start_work")).toBeEnabled();
  await expect(job.getByText(say("error.generic"))).toHaveCount(0);
  await workerPage.unroute(API_CALLS);

  const release = await holdCalls(workerPage);
  const note = job.getByRole("form", { name: say("a11y.note") });
  await note.getByRole("textbox").fill("Coming after lunch");
  await button(note, "job.send_note").click();
  await expect(note.getByRole("status")).toHaveText(say("busy.sending"));
  // The note box stays open: notes queue by themselves.
  await expect(note.getByRole("textbox")).toBeEnabled();
  await release();
  await expect(note.getByRole("status")).toBeEmpty();
});

test("a press answers the thumb, and Reduce Motion keeps the answer without the movement", async ({ browser }) => {
  contexts = [await browser.newContext()];
  const page = await contexts[0]?.newPage();
  if (!page) throw new Error("no page");
  await page.goto("/");
  const first = page.getByRole("button").first();
  await expect(first).toBeVisible();
  const box = await first.boundingBox();
  if (!box) throw new Error("no button");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(first).toHaveCSS("opacity", "0.75");
  await expect(first).not.toHaveCSS("transform", IDENTITY);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(first).toHaveCSS("opacity", "0.75");
  await expect(first).toHaveCSS("transform", IDENTITY);
  await page.mouse.up();
});
