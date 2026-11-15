import { plural, t } from "@gigsync/core";
import { expect, type Page, test } from "@playwright/test";
import { greeting, newPhone, open, Role, RUN, signIn } from "./helpers.js";
import { publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * A live demo to watch, not a check: two Chrome windows side by side, a household (English) on the left and an
 * electrician (Hindi) on the right, each with Ollama as its model. The household finds him by chat, their agents
 * negotiate, both sign, and both windows stay open for 15 minutes to look around. Needs the API and the dev server
 * running and Ollama serving qwen3.5:2b-q4_K_M (`ollama serve`, `ollama pull qwen3.5:2b-q4_K_M`). Run on request only:
 *   LIVE=1 pnpm exec playwright test live-demo --project=chromium --headed
 */
test.skip(!process.env.LIVE, "a demo to watch; run with LIVE=1 and --headed");
test.skip(({ browserName }) => browserName !== "chromium", "it places the windows through Chrome's own controls");
test.use({ launchOptions: { slowMo: 350 } });
test.afterEach(unlistCards);

const MODEL = JSON.stringify({ choice: "ollama", ollamaModel: "qwen3.5:2b-q4_K_M" });
const pause = (page: Page, ms = 2500) => page.waitForTimeout(ms);

async function place(page: Page, left: number) {
  const cdp = await page.context().newCDPSession(page);
  const { windowId } = await cdp.send("Browser.getWindowForTarget");
  await cdp.send("Browser.setWindowBounds", { windowId, bounds: { left, top: 0, width: 460, height: 960 } });
}

async function user(browser: import("@playwright/test").Browser, left: number) {
  const ctx = await browser.newContext({ viewport: { width: 440, height: 860 } });
  await ctx.addInitScript((m) => {
    if (!localStorage.getItem("CapacitorStorage.settings:model"))
      localStorage.setItem("CapacitorStorage.settings:model", m);
  }, MODEL);
  const page = await ctx.newPage();
  await place(page, left);
  return page;
}

async function say(page: Page, words: string) {
  const box = page.getByRole("form", { name: t("en", "need.composer") });
  await box.getByRole("textbox").pressSequentially(words, { delay: 30 });
  await box.getByRole("button", { name: t("en", "a11y.send") }).click();
}

test("live demo", async ({ browser }) => {
  test.setTimeout(1_800_000);
  const home = await user(browser, 0);
  const worker = await user(browser, 480);
  const ravi = `Ravi ${RUN}`;

  // Ravi, an electrician, in Hindi: signs in and puts his card on the board (₹900 usual, ₹650 lowest, private).
  await signIn(worker, { role: Role.worker, name: ravi, phone: newPhone(), lang: "hi" });
  await publishCard(
    { page: worker, lang: "hi" },
    { trade: t("hi", "trade.electrician"), area: "hsr_layout", rate: "900", min: "650", about: "पंखे, स्विच, वायरिंग" },
  );
  await open(worker, "nav.activity", "hi");

  // Priya, a household, in English: says what she needs in one sentence.
  await signIn(home, {
    role: Role.consumer,
    name: `Priya ${RUN}`,
    phone: newPhone(),
    address: `22, 5th Cross, HSR Layout (${RUN})`,
  });
  const log = home.getByRole("log");
  await expect(greeting(home, "en")).toBeVisible();
  await pause(home);
  await say(home, "Bedroom fan is not working, need an electrician tomorrow morning, up to 750");
  await expect(log).toContainText(t("en", "need.ask.address"), { timeout: 30_000 });
  await pause(home);
  await say(home, "HSR Layout");
  await pause(home, 3500);
  await log.getByRole("button", { name: t("en", "when.any_time"), exact: true }).click();
  await pause(home);
  await log.getByRole("button", { name: t("en", "flag.yes"), exact: true }).click();

  // The board: she asks Ravi only.
  const found = home.getByRole("group", { name: t("en", "a11y.ask_workers") });
  await expect(found.getByLabel(t("en", "a11y.worker", { name: ravi }))).toBeVisible({ timeout: 30_000 });
  for (const box of await found.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await found.getByRole("checkbox", { name: t("en", "a11y.ask_worker", { name: ravi }) }).check();
  await pause(home);
  await found.getByRole("button", { name: plural("en", "find.ask", 1) }).click();

  // Their agents talk; if Ravi's agent asks something, Priya answers it.
  const answer = home.getByRole("form", { name: t("en", "a11y.answer") });
  if (
    await answer.waitFor({ timeout: 20_000 }).then(
      () => true,
      () => false,
    )
  ) {
    await pause(home);
    await answer.getByRole("textbox").first().pressSequentially("The fan hums but does not spin", { delay: 30 });
    await answer.getByRole("button", { name: t("en", "job.send_answers") }).click();
  }
  await signBoth({ household: { page: home, lang: "en" }, worker: { page: worker, lang: "hi" } }, "live-demo");
  await expect(home.getByLabel(t("en", "a11y.contact"))).toBeVisible({ timeout: 30_000 });

  // Open both stories and leave the windows up to look at.
  for (const page of [home, worker]) {
    const fold = page.locator("details.job-talk").first();
    if ((await fold.count()) && !(await fold.getAttribute("open"))) await fold.locator("summary").click();
  }
  await home.waitForTimeout(900_000);
});
