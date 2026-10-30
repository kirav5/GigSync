import { type ApiClient, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { tellNeed } from "./findChat.js";
import { listWorker, newPhone, Role, RUN, signIn } from "./helpers.js";
import { pairKey, useDownloadableTranslator, useSilentTranslator, useUnfetchableTranslator } from "./translator.js";

/**
 * When the phone's translator never answers (Chrome 156 headless leaves `Translator.availability()` pending), the
 * reader still gets the original, named by language, instead of a spinner that never ends. This is the one case where
 * other people's words show in their language: beside the reason.
 */

const { hi, kn } = Lang.enum;
const ABOUT = "उत्तर और दक्षिण भारतीय खाना";
const KN_ABOUT = "ಉತ್ತರ ಮತ್ತು ದಕ್ಷಿಣ ಭಾರತೀಯ ಅಡುಗೆ";
let other: ApiClient | undefined;

test.afterEach(async () => {
  await other?.removeProfile();
});

/** Ravi asks Find's chat for a cook in HSR Layout, in Kannada, and says yes: the cooks nearby are listed. */
async function searchCooks(page: Page) {
  await tellNeed(
    { page, lang: kn },
    { trade: "cook", area: "HSR Layout", need: t(kn, "trade.cook"), when: "when.daily", budget: "9000" },
  );
}

test("a translator that never answers falls back to the original, labelled, within seconds", async ({ browser }) => {
  const context = await browser.newContext();
  await useSilentTranslator(context);
  const page = await context.newPage();
  const name = `Kavya ${RUN}`;
  other = await listWorker(name, ["cook"], { lat: 12.9116, lon: 77.6474 }, 900000, {
    area_name: "HSR Layout",
    languages: [hi],
  });
  // listWorker writes its own "about"; this worker's card says it in Hindi.
  await other.publishProfile({
    display_name: name,
    trades: ["cook"],
    area: { lat: 12.9116, lon: 77.6474 },
    area_name: "HSR Layout",
    rate_paise: 900000,
    languages: [hi],
    about: ABOUT,
  });

  await signIn(page, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone(), address: "HSR", lang: kn });
  await searchCooks(page);
  const card = page.getByLabel(t(kn, "a11y.worker", { name }));
  await expect(card).toContainText(t(kn, "said.cannot", { lang: t(kn, "lang.hi") }), { timeout: 10_000 });
  await expect(card.locator('[data-said="original"]')).toHaveText(ABOUT);
  await context.close();
});

test("language packs come by themselves: choosing a language fetches them, and a waiting line fetches on the next tap", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await useDownloadableTranslator(context, { [pairKey(hi, kn, ABOUT)]: KN_ABOUT });
  const page = await context.newPage();
  const name = `Kavya ${RUN}`;
  other = await listWorker(name, ["cook"], { lat: 12.9116, lon: 77.6474 }, 900000, {
    area_name: "HSR Layout",
    languages: [hi],
  });
  await other.publishProfile({
    display_name: name,
    trades: ["cook"],
    area: { lat: 12.9116, lon: 77.6474 },
    area_name: "HSR Layout",
    rate_paise: 900000,
    languages: [hi],
    about: ABOUT,
  });

  // Choosing Kannada is a tap: the packs that read Hindi and English in Kannada are fetched in that moment.
  await signIn(page, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone(), address: "HSR", lang: kn });
  const fetches = () =>
    page.evaluate(() => (globalThis as unknown as { packFetches: { pair: string; tapped: boolean }[] }).packFetches);
  await expect.poll(async () => (await fetches()).map((f) => f.pair).sort()).toEqual([`en>${kn}`, `${hi}>${kn}`]);
  expect((await fetches()).every((f) => f.tapped)).toBe(true);

  // Her Hindi "about" reads in Kannada, and nowhere is there a download button.
  await searchCooks(page);
  const card = page.getByLabel(t(kn, "a11y.worker", { name }));
  await expect(card.locator('[data-said="translated"]')).toHaveText(KN_ABOUT);
  await expect(page.getByRole("button", { name: /download|ಡೌನ್‌ಲೋಡ್/i })).toHaveCount(0);
  await context.close();
});

test("a pack that never arrives ends on the original with the reason, not an endless Translating", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await useUnfetchableTranslator(context);
  const page = await context.newPage();
  const name = `Kavya ${RUN}`;
  other = await listWorker(name, ["cook"], { lat: 12.9116, lon: 77.6474 }, 900000, {
    area_name: "HSR Layout",
    languages: [hi],
  });
  await other.publishProfile({
    display_name: name,
    trades: ["cook"],
    area: { lat: 12.9116, lon: 77.6474 },
    area_name: "HSR Layout",
    rate_paise: 900000,
    languages: [hi],
    about: ABOUT,
  });
  await signIn(page, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone(), address: "HSR", lang: kn });
  await searchCooks(page);
  const card = page.getByLabel(t(kn, "a11y.worker", { name }));
  await expect(card).toContainText(t(kn, "said.cannot", { lang: t(kn, "lang.hi") }), { timeout: 10_000 });
  await expect(card).not.toContainText(t(kn, "said.translating"));
  await context.close();
});
