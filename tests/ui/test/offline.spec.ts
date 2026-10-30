import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { tellNeed } from "./findChat.js";
import { APP, newPhone, open, Role, RUN, SHOTS, signIn } from "./helpers.js";

/**
 * The installed web app without a network (round2-spec §6): a production build, served where the dev server usually
 * is, installs its service worker on the first visit; with the phone then offline, the app still opens from the
 * cache, the owner stays signed in, and a search says the phone is offline instead of spinning. Run on request,
 * against a production preview on the dev server's port (the local API allows only that origin):
 *   pnpm --filter @gigsync/mobile build && pnpm --filter @gigsync/mobile exec vite preview --port 5173 --strictPort
 *   OFFLINE=1 pnpm exec playwright test offline --project=chromium
 */

const ON = process.env.OFFLINE;
const { hi } = Lang.enum;
const DIR = `${SHOTS}offline/`;

test.skip(!ON, "offline check runs on request against a production preview (OFFLINE=1)");

test("the installed web app opens offline, keeps the owner signed in, and says it is offline", async ({ browser }) => {
  test.setTimeout(180_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(APP);
  // The service worker installs and takes the page over: the shell is in its cache from here on.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  await signIn(page, {
    role: Role.consumer,
    name: `Offline ${RUN}`,
    phone: newPhone(),
    address: "Indiranagar",
    lang: hi,
  });
  const chat = page.getByRole("form", { name: t(hi, "need.composer") });
  await expect(chat).toBeVisible();
  await page.screenshot({ path: `${DIR}01-online.png` });

  await ctx.setOffline(true);
  await page.reload();
  // Opened from the cache, still signed in, still in Hindi, on Find's chat.
  await expect(chat).toBeVisible();
  await page.screenshot({ path: `${DIR}02-offline-reopened.png` });
  await tellNeed(
    { page, lang: hi },
    { trade: "electrician", area: "Indiranagar", need: t(hi, "trade.electrician"), when: "when.today", budget: "700" },
  );
  await expect(page.getByRole("log").getByText(t(hi, "net.no_internet"))).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${DIR}03-offline-search.png` });
  await open(page, "nav.about", hi);
  await page.screenshot({ path: `${DIR}04-offline-about.png` });
  await ctx.close();
});
