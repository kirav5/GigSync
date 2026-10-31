import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { APP, newPhone, open, Role, RUN, SHOTS, signIn } from "./helpers.js";

/**
 * The visual pass (round2-spec §6): each main screen of a worker and a household, in English, Hindi and Kannada, in
 * the light and dark looks (the look is Auto, so it follows the phone's scheme), at a common phone size. It only takes
 * screenshots for a person to look at; run it on request:
 *   VISUAL=1 pnpm exec playwright test visual --project=chromium
 */

const ON = process.env.VISUAL;
const PHONE = { width: 390, height: 844 };
const SCHEMES = ["light", "dark"] as const;
type Scheme = (typeof SCHEMES)[number];

test.skip(!ON, "visual pass runs on request (VISUAL=1)");

let ctx: BrowserContext | undefined;
test.afterEach(async () => ctx?.close());

/** Saves the screen as the owner sees it, scrolled to the top, then the whole page. */
async function snap(page: Page, dir: string, name: string) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}${name}.png` });
  await page.screenshot({ path: `${dir}${name}-full.png`, fullPage: true });
}

for (const lang of Lang.options)
  for (const scheme of SCHEMES)
    test(`${lang} ${scheme}: worker and household screens`, async ({ browser }) => {
      test.setTimeout(240_000);
      const dir = `${SHOTS}visual/${lang}-${scheme as Scheme}/`;
      ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, colorScheme: scheme });
      const worker = await ctx.newPage();
      const household = await (
        await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, colorScheme: scheme })
      ).newPage();
      await worker.goto(APP);
      await expect(worker.getByRole("radio").first()).toBeVisible();
      await snap(worker, dir, "00-language");

      await signIn(worker, { role: Role.worker, name: `Visual ${RUN}`, phone: newPhone(), lang });
      await open(worker, "nav.activity", lang);
      await snap(worker, dir, "01-worker-today");
      await open(worker, "nav.talk", lang);
      await expect(worker.getByRole("log")).toBeVisible();
      await snap(worker, dir, "02-worker-talk");
      await open(worker, "nav.records", lang);
      await snap(worker, dir, "03-worker-records");
      await open(worker, "nav.about", lang);
      await snap(worker, dir, "04-worker-about");

      await signIn(household, {
        role: Role.consumer,
        name: `Home ${RUN}`,
        phone: newPhone(),
        address: "Indiranagar",
        lang,
      });
      await snap(household, dir, "05-household-find");
      await open(household, "nav.my_jobs", lang);
      await snap(household, dir, "06-household-activity");
      await open(household, "nav.records", lang);
      await snap(household, dir, "07-household-records");
      await household.context().close();
    });
