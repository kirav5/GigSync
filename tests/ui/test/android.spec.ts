import { plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type AndroidDevice, expect, test } from "@playwright/test";
import { androidPhone, deviceShot as shotOf } from "./android-phone.js";
import { newPhone, open, openCard, Role, RUN, signIn, textOf } from "./helpers.js";
import { fillAsk, type Phone, publishCard, sendNote, signBoth, unlistCards } from "./journey.js";

/**
 * Asha's phone is a real Android emulator running the Capacitor app, driven through Playwright's Android support
 * (adb, then the app's WebView); Ravi is desktop Chromium. Her phone translates Ravi's Kannada with ML Kit on the
 * device, after she taps to fetch the language packs, as the design asks. Runs only when an emulator is attached and
 * adb is on the PATH; the test forwards the dev server's and API's ports itself:
 *   ANDROID=1 pnpm exec playwright test android --project=chromium
 */

const ON = process.env.ANDROID;
/**
 * Where the journey happens. A workaround, not the story's place: Koramangala's cook listings on the shared board are
 * full of cards earlier aborted runs left behind (kept there by the owner's decision), and they outrank a new card.
 */
const AREA = { key: "indiranagar", name: "Indiranagar" } as const;
const { hi, kn } = Lang.enum;
const KN_NEED = "ಬೆಳಗ್ಗೆ ಅಡುಗೆ ಮಾಡುವವರು ಬೇಕು";
const KN_MEALS = "ಬೆಳಗ್ಗೆ ಮತ್ತು ರಾತ್ರಿ";
const DEVANAGARI = /[ऀ-ॿ]/;
const KANNADA = /[ಀ-೿]/;
/** A line of his the phone translated (ui/Said.tsx); `[lang=hi]` would also match the page and the job card. */
const TRANSLATED = '[data-said="translated"]';
/** The note every translated line used to carry ("machine translated from Kannada"), gone for good. */
const OLD_NOTE = "मशीन अनुवाद";
/** ML Kit fetches two ~30 MB language packs on the first translation. */
const DOWNLOAD_MS = 240_000;

test.skip(!ON, "no Android emulator attached (ANDROID=1)");
test.afterEach(unlistCards);

let phone: AndroidDevice;

/** The emulator's own screen, as the person holding the phone sees it. */
const deviceShot = (name: string) => shotOf(phone, name);

test("Hindi cook on Android, Kannada household: ML Kit translates his words on her phone", async ({ browser }) => {
  test.setTimeout(600_000);
  const { phone: device, page } = await androidPhone();
  phone = device;
  const asha: Phone = { page, lang: hi };
  const ctx = await browser.newContext();
  const ravi: Phone = { page: await ctx.newPage(), lang: kn };
  const ashaName = `Asha ${RUN}`;

  await signIn(asha.page, { role: Role.worker, name: ashaName, phone: newPhone(), lang: hi });
  await signIn(ravi.page, {
    role: Role.consumer,
    name: `Ravi ${RUN}`,
    phone: newPhone(),
    address: AREA.name,
    lang: kn,
  });
  await publishCard(asha, {
    trade: t(hi, "trade.cook"),
    area: AREA.key,
    rate: "9500",
    min: "8000",
    about: "उत्तर और दक्षिण भारतीय खाना",
    askFirst: true,
  });
  await deviceShot("01-card");
  await fillAsk(ravi, {
    trade: "cook",
    area: AREA.name,
    worker: ashaName,
    need: KN_NEED,
    when: "when.daily",
    time: "ಸೋಮ–ಶನಿ 7–10",
    budget: "9500",
  });
  await ravi.page.getByRole("button", { name: plural(kn, "find.ask", 1) }).click();

  await open(asha.page, "nav.today", hi);
  const answer = ravi.page.getByRole("form", { name: t(kn, "a11y.answer") });
  await answer.getByLabel(questionText(kn, "people")).fill("3");
  await answer.getByLabel(questionText(kn, "meals")).fill(KN_MEALS);
  await answer.getByLabel(questionText(kn, "pets")).selectOption("yes");
  await answer.getByRole("button", { name: t(kn, "job.send_answers") }).click();

  // Her phone has no Kannada pack yet: the line says it is translating, never shows Kannada, and her next tap anywhere
  // fetches the pack (engines only download from a tap); there is no download button to find.
  const job = asha.page.getByRole("article");
  await expect(job.getByText(t(hi, "said.translating")).first()).toBeVisible({ timeout: 60_000 });
  await deviceShot("02-translating");
  await job.first().click();
  const translated = job.locator(TRANSLATED).first();
  await expect(translated).toBeVisible({ timeout: DOWNLOAD_MS });
  // Every line of his reads in Hindi alone once the pack is here: no Kannada, and no note saying it was translated.
  await expect(job).not.toContainText(KN_NEED);
  await expect(job).not.toContainText(KANNADA);
  await expect(job).not.toContainText(OLD_NOTE);
  expect(await translated.textContent()).toMatch(DEVANAGARI);
  console.log("ML Kit kn→hi:", KN_NEED, "→", (await translated.textContent())?.trim());
  await deviceShot("03-mlkit-translated");

  const check = asha.page.getByRole("group", { name: t(hi, "a11y.approve") });
  await check.getByRole("button", { name: textOf(hi, "approve.yes") }).click();
  await signBoth({ worker: asha, customer: ravi }, "android");
  await expect(asha.page.getByLabel(t(hi, "a11y.contact"))).toContainText(AREA.name);
  await deviceShot("04-signed");
  await sendNote(asha, "गेट पर 10 मिनट में पहुँचूँगी");
  await expect(ravi.page.getByRole("list", { name: t(kn, "a11y.notes") })).toContainText("गेट पर 10 मिनट");

  await open(asha.page, "nav.profile", hi);
  await expect(asha.page.getByRole("region", { name: t(hi, "translation.title") })).toContainText("ML Kit");
  await deviceShot("05-settings");
  await openCard(asha.page, hi);
  await asha.page.getByRole("button", { name: t(hi, "card.unlist") }).click();
  await ctx.close();
  await phone.close();
});
