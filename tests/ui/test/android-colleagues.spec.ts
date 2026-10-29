import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type AndroidDevice, type BrowserContext, expect, test } from "@playwright/test";
import { androidPhone, deviceShot, PACKAGE } from "./android-phone.js";
import { newPhone, open, Role, RUN, signIn } from "./helpers.js";
import type { Phone } from "./journey.js";
import { pairKey, useTableTranslator } from "./translator.js";

/**
 * Worker to worker on a real Android build: Asha's phone is the emulator (Hindi), Bhavya is desktop Chromium
 * (Kannada). Asha shows her colleague code and Bhavya links with it (pasted through the dev-only field, as the desktop
 * has no camera); Bhavya's Kannada note reaches the phone and ML Kit puts it into Hindi there, after Asha's tap; then
 * the phone's camera path runs: the app's own explanation in Hindi, Android's permission prompt, and the live camera.
 *   ANDROID=1 pnpm exec playwright test android-colleagues --project=chromium
 */

const ON = process.env.ANDROID;
const { hi, kn } = Lang.enum;
const KN_HELLO = "ನಮಸ್ಕಾರ, ನಾಳೆ ಕೆಲಸ ಇದೆಯಾ?";
const HI_REPLY = "कल सुबह खाली हूँ";
const DEVANAGARI = /[ऀ-ॿ]/;
const TRANSLATED = '[data-said="translated"]';
const INVITE = "data-invite";
/** ML Kit fetches its Kannada and Hindi packs on the first translation. */
const DOWNLOAD_MS = 240_000;
/** Android's runtime permission prompt: "While using the app". */
const ALLOW_CAMERA = { res: "com.android.permissioncontroller:id/permission_allow_foreground_only_button" };

test.skip(!ON, "no Android emulator attached (ANDROID=1)");

let ctx: BrowserContext | undefined;
test.afterEach(async () => ctx?.close());

const colleaguesOn = ({ page, lang }: Phone) => page.getByRole("region", { name: t(lang, "colleague.title") });

async function write({ page, lang }: Phone, to: string, text: string) {
  const box = page.getByRole("form", { name: to });
  await box.getByRole("textbox").fill(text);
  await box.getByRole("button", { name: t(lang, "a11y.send") }).click();
}

/** Grants the camera through Android's own prompt when it shows; an emulator that answered already needs nothing. */
async function allowCamera(phone: AndroidDevice) {
  await phone.tap(ALLOW_CAMERA, { timeout: 15_000 }).catch(async () => {
    await phone.shell(`pm grant ${PACKAGE} android.permission.CAMERA`);
  });
}

test("Android worker links with a colleague, reads her Kannada in Hindi through ML Kit, and opens the camera", async ({
  browser,
}) => {
  test.setTimeout(600_000);
  const { phone, page } = await androidPhone();
  const asha: Phone = { page, lang: hi };
  ctx = await browser.newContext();
  await useTableTranslator(ctx, { [pairKey(hi, kn, HI_REPLY)]: "ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಬಿಡುವಾಗಿದ್ದೇನೆ" });
  const bhavya: Phone = { page: await ctx.newPage(), lang: kn };
  const ashaName = `Asha ${RUN}`;
  const bhavyaName = `Bhavya ${RUN}`;
  await signIn(asha.page, { role: Role.worker, name: ashaName, phone: newPhone(), lang: hi });
  await signIn(bhavya.page, { role: Role.worker, name: bhavyaName, phone: newPhone(), lang: kn });

  // ── The phone shows Asha's code; Bhavya links with it ───────────────────────────────────────────────────────────
  await open(asha.page, "nav.profile", hi);
  await colleaguesOn(asha)
    .getByRole("button", { name: t(hi, "colleague.show_code") })
    .click();
  const qr = asha.page.locator(`[${INVITE}]`);
  await expect(qr).toBeVisible();
  const code = (await qr.getAttribute(INVITE)) ?? "";
  await deviceShot(phone, "w2w-01-code");

  await open(bhavya.page, "nav.profile", kn);
  await colleaguesOn(bhavya)
    .getByRole("button", { name: t(kn, "colleague.scan") })
    .click();
  const paste = bhavya.page.getByRole("form", { name: t(kn, "colleague.paste") });
  await paste.getByRole("textbox").fill(code);
  await paste.getByRole("button", { name: t(kn, "colleague.link") }).click();
  await bhavya.page
    .getByRole("dialog", { name: t(kn, "colleague.confirm", { name: ashaName }) })
    .getByRole("button", { name: t(kn, "colleague.link") })
    .click();
  await expect(
    asha.page.getByRole("status").filter({ hasText: t(hi, "colleague.linked", { name: bhavyaName }) }),
  ).toBeVisible({
    timeout: 60_000,
  });
  await deviceShot(phone, "w2w-02-linked");

  // ── Bhavya writes in Kannada; the phone fetches its packs on Asha's tap and shows the note in Hindi ─────────────
  await bhavya.page.getByRole("button", { name: new RegExp(ashaName) }).click();
  await write(bhavya, ashaName, KN_HELLO);
  await asha.page.getByRole("button", { name: new RegExp(bhavyaName) }).click();
  const fetch = asha.page.getByRole("button", { name: t(hi, "said.download", { lang: t(hi, "lang.kn") }) }).first();
  await expect(fetch).toBeVisible({ timeout: 60_000 });
  await fetch.click();
  const translated = asha.page.locator(TRANSLATED).first();
  await expect(translated).toBeVisible({ timeout: DOWNLOAD_MS });
  expect(await translated.textContent()).toMatch(DEVANAGARI);
  await expect(asha.page.getByText(KN_HELLO)).toHaveCount(0);
  console.log("ML Kit kn→hi (colleague note):", KN_HELLO, "→", (await translated.textContent())?.trim());
  await write(asha, bhavyaName, HI_REPLY);
  await expect(bhavya.page.locator(TRANSLATED)).toHaveText("ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಬಿಡುವಾಗಿದ್ದೇನೆ", { timeout: 60_000 });
  await deviceShot(phone, "w2w-03-chat-hindi");

  // ── The camera: the app explains in Hindi first, then Android asks, then the camera runs ───────────────────────
  // Back from the thread lands on the Colleagues list, where Scan is.
  await asha.page.getByRole("button", { name: t(hi, "a11y.back") }).click();
  await asha.page.getByRole("button", { name: t(hi, "colleague.scan") }).click();
  const why = asha.page.getByRole("dialog", { name: t(hi, "perm.camera_why") });
  await expect(why).toBeVisible();
  await deviceShot(phone, "w2w-04-camera-why");
  await why.getByRole("button", { name: t(hi, "perm.continue") }).click();
  await allowCamera(phone);
  const video = asha.page.locator("video.qr-scanner");
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth), { timeout: 20_000 })
    .toBeGreaterThan(0);
  await deviceShot(phone, "w2w-05-camera-live");
});
