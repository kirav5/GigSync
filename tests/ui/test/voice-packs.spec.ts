import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import {
  FakeSpeechMode,
  fakeFetches,
  fakeSaid,
  fakeSpeech,
  newPhone,
  onScreen,
  open,
  Role,
  RUN,
  signIn,
  textOf,
} from "./helpers.js";
import { field, mic, nextTurn } from "./talk.js";

/**
 * Voice typing and the read-aloud voice come by themselves, like the translation packs: choosing a language fetches
 * its voice typing, a tap on the mic or a speaker fetches what is still missing, a pack installed while the app was
 * away shows when it comes back, and nowhere is there a download link. The phone is the dev build's fake engine
 * (adapters/speech-fake.ts): "downloadable" fetches only during a tap, as real engines do, and forgets what it fetched
 * on a reload; "unfetchable" offers packs that never come.
 */

const { hi } = Lang.enum;
const HINDI = "hi-IN";
const Mode = { listen: "listen", speak: "speak" } as const;
/** A cook is asked which work she takes next (ADR 0051). */
const ANSWERS = ["मैं खाना बनाती हूँ", "हर महीने"];
/** "Download" on a button or a line, in any of the app's languages. */
const DOWNLOAD = /download|डाउनलोड|ಡೌನ್‌ಲೋಡ್/i;
/** A fake fetch ends in 1.5 s (FETCH_MS in the app's speech-fake.ts) and the composer checks every 3 s. */
const FETCH_MS = 1_500;
/** Give the composer a few rounds. */
const ARRIVES_MS = 15_000;

const fetching = (page: Page) =>
  page.getByRole("status").filter({ hasText: textOf(hi, "speech.fetching", { lang: t(hi, "lang.hi") }) });
const pleaseType = (page: Page) => page.getByText(t(hi, "speech.unavailable", { lang: t(hi, "lang.hi") }));
const speaker = (page: Page) => page.getByRole("button", { name: t(hi, "speech.replay") });
const fetchesOf = async (page: Page, mode: string) => (await fakeFetches(page)).filter((f) => f.mode === mode);
const question = (page: Page) => page.getByText(textOf(hi, "iv.ask.trade"));

/**
 * Talk, the voice section of Settings, and no download link for voice on either. Settings' model section has its own
 * downloads (the understanding pack, ADR 0042, and the on-device model), offered on a tap; those are not voice.
 */
async function noDownloadLink(page: Page) {
  await expect(page.getByRole("button", { name: DOWNLOAD })).toHaveCount(0);
  await expect(page.getByText(DOWNLOAD)).toHaveCount(0);
  await open(page, "nav.settings", hi);
  await expect(page.getByRole("region", { name: t(hi, "speech.title") })).toHaveCount(0);
  const models = page.getByRole("region", { name: t(hi, "model.title") });
  const outsideModels = async () =>
    (await page.getByText(DOWNLOAD).count()) - (await models.getByText(DOWNLOAD).count());
  await expect.poll(outsideModels).toBe(0);
  await open(page, "nav.talk", hi);
}

async function hindiCook(page: Page, mode: FakeSpeechMode) {
  await fakeSpeech(page, ANSWERS, mode);
  await signIn(page, { role: Role.worker, name: `Asha ${RUN}`, phone: newPhone(), lang: hi });
  await onScreen(page, "nav.talk", hi);
  await expect(question(page)).toBeVisible();
}

/** Hindi's voice typing and voice installed outside the app (Android's own screen), then the app shown again. */
async function installWhileAway(page: Page) {
  await page.evaluate(
    (installed) => {
      localStorage.setItem("gigsync-fake-speech-installed", JSON.stringify(installed));
      document.dispatchEvent(new Event("visibilitychange"));
    },
    [`${Mode.listen}:${HINDI}`, `${Mode.speak}:${HINDI}`],
  );
}

test("choosing Hindi fetches its voice typing in that tap, not the voice, and the mic then simply works", async ({
  page,
}) => {
  await hindiCook(page, FakeSpeechMode.downloadable);
  const fetches = await fakeFetches(page);
  expect(fetches.map((f) => `${f.mode}:${f.lang}`)).toEqual([`${Mode.listen}:${HINDI}`]);
  expect(fetches.every((f) => f.tapped)).toBe(true);

  // Someone reads the first question before reaching the mic; a test that signs in faster than the fetch would tap
  // while voice typing is still on its way, which is the next test's case.
  await page.waitForTimeout(FETCH_MS);
  await nextTurn(page, hi, "iv.ask.also", () => mic(page, hi).click());
  // The voice can still come, by a tap on a speaker.
  await expect(speaker(page).first()).toBeVisible();
  await noDownloadLink(page);
});

test("a mic tap fetches voice typing still missing, says so with the cursor in the field, and the mic then works", async ({
  page,
}) => {
  await hindiCook(page, FakeSpeechMode.downloadable);
  // A reload is a phone where nothing came yet: the fake forgets what it fetched.
  await page.reload();
  await expect(question(page)).toBeVisible();

  await mic(page, hi).click();
  await expect(fetching(page)).toBeVisible();
  await expect(field(page, hi)).toBeFocused();
  await expect.poll(async () => (await fetchesOf(page, Mode.listen)).length).toBe(2);
  expect((await fetchesOf(page, Mode.listen)).at(-1)?.tapped).toBe(true);

  await expect(fetching(page)).toBeHidden({ timeout: ARRIVES_MS });
  await nextTurn(page, hi, "iv.ask.also", () => mic(page, hi).click());
  await noDownloadLink(page);
});

test("a speaker tap fetches the voice and reads the question once it is here", async ({ page }) => {
  await hindiCook(page, FakeSpeechMode.downloadable);
  expect(await fetchesOf(page, Mode.speak)).toHaveLength(0);

  await speaker(page).last().click();
  await expect.poll(async () => (await fetchesOf(page, Mode.speak)).length).toBe(1);
  expect((await fetchesOf(page, Mode.speak))[0]?.tapped).toBe(true);
  await expect.poll(async () => (await fakeSaid(page)).length, { timeout: ARRIVES_MS }).toBe(1);
  expect((await fakeSaid(page))[0]).toMatch(textOf(hi, "iv.ask.trade"));
});

test("voice that never comes: the mic says to type, and the speaker goes once tried", async ({ page }) => {
  await hindiCook(page, FakeSpeechMode.unfetchable);
  // Choosing Hindi asked for voice typing; it did not come, so it is not offered again.
  expect(await fetchesOf(page, Mode.listen)).toHaveLength(1);
  await mic(page, hi).click();
  await expect(pleaseType(page)).toBeVisible();
  await expect(field(page, hi)).toBeFocused();
  await speaker(page).last().click();
  await expect(speaker(page)).toHaveCount(0);
  expect(await fetchesOf(page, Mode.speak)).toHaveLength(1);
  expect(await fakeSaid(page)).toHaveLength(0);

  // After a reload the mic tries once more in its tap, then says to type.
  await page.reload();
  await expect(question(page)).toBeVisible();
  await mic(page, hi).click();
  await expect(pleaseType(page)).toBeVisible();
  await expect(field(page, hi)).toBeFocused();
  expect(await fetchesOf(page, Mode.listen)).toHaveLength(2);
  await noDownloadLink(page);
});

test("voice installed while the app was away shows when it comes back: speakers return and the mic hears", async ({
  page,
}) => {
  await hindiCook(page, FakeSpeechMode.unfetchable);
  await speaker(page).last().click();
  await expect(speaker(page)).toHaveCount(0);

  await installWhileAway(page);
  await expect(speaker(page).first()).toBeVisible();
  // The earlier tap does not speak by itself; a new one does.
  expect(await fakeSaid(page)).toHaveLength(0);
  await speaker(page).last().click();
  await expect.poll(async () => (await fakeSaid(page)).length).toBe(1);
  await nextTurn(page, hi, "iv.ask.also", () => mic(page, hi).click());
});
