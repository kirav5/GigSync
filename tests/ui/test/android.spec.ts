import { execFileSync } from "node:child_process";
import { plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { _android, type AndroidDevice, expect, type Page, test } from "@playwright/test";
import { API, APP, newPhone, open, Role, RUN, SHOTS, screenSizeShots, signIn } from "./helpers.js";
import { fillAsk, type Phone, publishCard, sendNote, signBoth } from "./journey.js";

/**
 * Asha's phone is a real Android emulator running the Capacitor app, driven through Playwright's Android support
 * (adb, then the app's WebView); Ravi is desktop Chromium. Her phone translates Ravi's Kannada with ML Kit on the
 * device, after she taps to fetch the language packs, as the design asks. Runs only when an emulator is attached and
 * adb is on the PATH; the test forwards the dev server's and API's ports itself:
 *   ANDROID=1 pnpm exec playwright test android --project=chromium
 */

const ON = process.env.ANDROID;
const PACKAGE = "app.gigsync";
const { hi, kn } = Lang.enum;
const KN_NEED = "ಬೆಳಗ್ಗೆ ಅಡುಗೆ ಮಾಡುವವರು ಬೇಕು";
const KN_MEALS = "ಬೆಳಗ್ಗೆ ಮತ್ತು ರಾತ್ರಿ";
const DEVANAGARI = /[ऀ-ॿ]/;
/** ML Kit fetches two ~30 MB language packs on the first translation. */
const DOWNLOAD_MS = 240_000;

test.skip(!ON, "no Android emulator attached (ANDROID=1)");

let phone: AndroidDevice;

/** The emulator's own screen, as the person holding the phone sees it. */
const deviceShot = (name: string) => phone.screenshot({ path: `${SHOTS}android-${name}.png` });

async function androidPage(): Promise<Page> {
  const [device] = await _android.devices();
  if (!device) throw new Error("no Android device: start the emulator first");
  phone = device;
  // The emulator reaches the dev server and API on this computer through adb; a reconnect drops these, so set them.
  for (const url of [APP, API]) {
    const port = new URL(url).port;
    execFileSync("adb", ["-s", phone.serial(), "reverse", `tcp:${port}`, `tcp:${port}`]);
  }
  // A fresh install each run: no saved language or account, and no ML Kit packs from an earlier run.
  await phone.shell(`pm clear ${PACKAGE}`);
  await phone.shell(`am start -W -n ${PACKAGE}/.MainActivity`);
  const page = await (await phone.webView({ pkg: PACKAGE })).page();
  screenSizeShots.add(page);
  // A lost `adb reverse` leaves the app on screen but every request failing: say so now, not after the timeout.
  const reached = await page.evaluate(
    (url) =>
      fetch(url).then(
        (r) => r.ok,
        () => false,
      ),
    `${API}/health`,
  );
  if (!reached) throw new Error(`the phone cannot reach ${API}: run adb reverse tcp:8787 tcp:8787 (and 5173)`);
  return page;
}

test("Hindi cook on Android, Kannada household: ML Kit translates his words on her phone", async ({ browser }) => {
  test.setTimeout(600_000);
  const page = await androidPage();
  const asha: Phone = { page, lang: hi };
  const ctx = await browser.newContext();
  const ravi: Phone = { page: await ctx.newPage(), lang: kn };
  const ashaName = `Asha ${RUN}`;

  await signIn(asha.page, { role: Role.worker, name: ashaName, phone: newPhone(), lang: hi });
  await signIn(ravi.page, {
    role: Role.consumer,
    name: `Ravi ${RUN}`,
    phone: newPhone(),
    address: "Koramangala",
    lang: kn,
  });
  await publishCard(asha, {
    trade: t(hi, "trade.cook"),
    area: "Koramangala",
    rate: "9500",
    min: "8000",
    vpa: "asha.test@okaxis",
    about: "उत्तर और दक्षिण भारतीय खाना",
    askFirst: true,
  });
  await deviceShot("01-card");
  await fillAsk(ravi, {
    trade: "cook",
    area: "Koramangala",
    worker: ashaName,
    need: KN_NEED,
    when: "ಸೋಮ–ಶನಿ 7–10",
    budget: "9500",
  });
  await ravi.page.getByRole("button", { name: plural(kn, "find.ask", 1) }).click();

  await open(asha.page, "nav.requests", hi);
  const answer = ravi.page.getByRole("form", { name: t(kn, "a11y.answer") });
  await answer.getByLabel(questionText(kn, "people")).fill("3");
  await answer.getByLabel(questionText(kn, "meals")).fill(KN_MEALS);
  await answer.getByLabel(questionText(kn, "pets")).selectOption("yes");
  await answer.getByRole("button", { name: t(kn, "job.send_answers") }).click();

  // Her phone has no Kannada pack yet: it offers to fetch one, and only her tap does it.
  const job = asha.page.getByRole("article");
  const fetch = job.getByRole("button", { name: t(hi, "said.download", { lang: t(hi, "lang.kn") }) }).first();
  await expect(fetch).toBeVisible({ timeout: 60_000 });
  await deviceShot("02-offer-download");
  await fetch.click();
  const translated = job.locator(".said", { hasText: t(hi, "said.translated", { lang: t(hi, "lang.kn") }) }).first();
  await expect(translated).toBeVisible({ timeout: DOWNLOAD_MS });
  // Every line of his reads in Hindi alone once the pack is here; his Kannada is not shown.
  await expect(job.getByRole("button", { name: t(hi, "said.download", { lang: t(hi, "lang.kn") }) })).toHaveCount(0);
  await expect(job).not.toContainText(KN_NEED);
  expect(await translated.textContent()).toMatch(DEVANAGARI);
  console.log("ML Kit kn→hi:", KN_NEED, "→", (await translated.locator("[lang=hi]").first().textContent())?.trim());
  await deviceShot("03-mlkit-translated");

  const check = asha.page.getByRole("group", { name: t(hi, "a11y.approve") });
  await check.getByRole("button").first().click();
  await signBoth({ worker: asha, customer: ravi }, "android");
  await expect(asha.page.getByLabel(t(hi, "a11y.contact"))).toContainText("Koramangala");
  await deviceShot("04-signed");
  await sendNote(asha, "गेट पर 10 मिनट में पहुँचूँगी");
  await expect(ravi.page.getByRole("list", { name: t(kn, "a11y.notes") })).toContainText("गेट पर 10 मिनट");

  await open(asha.page, "nav.settings", hi);
  await expect(asha.page.getByRole("region", { name: t(hi, "translation.title") })).toContainText("ML Kit");
  await deviceShot("05-settings");
  await open(asha.page, "nav.card", hi);
  await asha.page.getByRole("button", { name: t(hi, "card.unlist") }).click();
  await ctx.close();
  await phone.close();
});
