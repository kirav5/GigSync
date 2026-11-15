import { type MessageKey, t } from "@gigsync/core";
import { DEFAULT_LANG, type Lang } from "@gigsync/protocol";
import { expect, type Page } from "@playwright/test";

/**
 * Home and every chat as the specs reach them (the design's Home): the greeting while the chat is empty, and the one
 * composer, with its "+" of quick picks, the enter button that comes with typed words, the small mic that types by
 * voice, and the round voice button.
 */

/** The composer's class: one pill on every chat, whoever owns it (ui/Composer.tsx). */
const COMPOSER = "form.composer";

/** The composer on screen, whichever chat it is in. */
export const composer = (page: Page) => page.locator(COMPOSER);

/** "Namaste, <name>": Home's greeting, while its chat is empty. */
export const greeting = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("heading", { level: 1, name: new RegExp(`^${t(lang, "tabs.namaste", { name: ".+" })}$`) });

/** The composer's buttons, by the names both owners hear them by. */
export const composerButton = (page: Page, key: MessageKey, lang: Lang = DEFAULT_LANG) =>
  composer(page).getByRole("button", { name: t(lang, key), exact: true });

/** Opens the composer's "+" and taps one of its quick picks, as "Pick from a list" on a household's Home. */
export async function morePick(page: Page, key: MessageKey, lang: Lang = DEFAULT_LANG) {
  await composerButton(page, "composer.more", lang).click();
  const sheet = page.getByRole("dialog", { name: t(lang, "composer.more_title") });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: t(lang, key), exact: true }).click();
  await expect(sheet).toBeHidden();
}

/** Dev builds only: each listen of the fake engine hears its words and stays open until Done or Cancel stops it. */
export async function holdListening(page: Page) {
  await page.addInitScript(() => localStorage.setItem("gigsync-fake-speech-hold", "1"));
}

/** The listening sheet over the chat, while either mic listens: Cancel (×) and Done at its foot. */
export const listeningSheet = (page: Page, lang: Lang = DEFAULT_LANG) =>
  page.getByRole("dialog", { name: t(lang, "speech.listening") });
