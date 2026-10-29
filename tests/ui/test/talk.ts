import { type MessageKey, t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { expect, type Page } from "@playwright/test";
import { open, openCard, textOf } from "./helpers.js";

/** Talk's composer, its mic and the card interview, as the specs that drive them by voice or by typing see them. */

export const mic = (page: Page, lang: Lang) => page.getByRole("button", { name: t(lang, "speech.listen") });
export const google = (lang: Lang) => t(lang, "speech.vendor_google");
/** The consent sheet's question and its two answers, for a phone whose only recognizer is Google's. */
export const consent = (page: Page, lang: Lang) => ({
  ask: page.getByText(textOf(lang, "speech.cloud_ask", { lang: t(lang, `lang.${lang}`), vendor: google(lang) })),
  allow: page.getByRole("button", { name: t(lang, "speech.cloud_yes"), exact: true }),
  typeInstead: page.getByRole("button", { name: t(lang, "speech.cloud_no"), exact: true }),
});
export const field = (page: Page, lang: Lang) =>
  page.getByRole("form", { name: t(lang, "nav.talk") }).getByPlaceholder(t(lang, "agent.placeholder"));

/** Does `act`, then waits for one more line reading `key`: earlier turns stay on screen, so a count says it is new. */
export async function nextTurn(page: Page, lang: Lang, key: MessageKey, act: () => Promise<void>) {
  const lines = page.getByText(textOf(lang, key));
  const before = await lines.count();
  await act();
  await expect(lines).toHaveCount(before + 1);
}

/** Where `re` first matches `text` at or after `from`; -1 when it does not. */
function searchFrom(text: string, re: RegExp, from: number): number {
  const find = new RegExp(re.source, "g");
  find.lastIndex = from;
  return find.exec(text)?.index ?? -1;
}

/** Asserts that each mark appears in Talk's conversation after the one before it: the turns are in the order said. */
export async function inOrder(page: Page, marks: readonly (string | RegExp)[]) {
  const text = (await page.getByRole("log").textContent()) ?? "";
  let from = 0;
  for (const mark of marks) {
    const at = typeof mark === "string" ? text.indexOf(mark, from) : searchFrom(text, mark, from);
    expect(at, `${mark} after the turns before it`).toBeGreaterThanOrEqual(from);
    from = at + 1;
  }
}

/** Types an answer into Talk's composer and sends it. */
export async function type(page: Page, lang: Lang, text: string) {
  await field(page, lang).fill(text);
  await page.getByRole("button", { name: t(lang, "a11y.send"), exact: true }).click();
}

/** Takes the card off the board, so later runs start clean, and waits until Profile says so. */
export async function unlist(page: Page, lang: Lang) {
  await openCard(page, lang);
  await page.getByRole("button", { name: t(lang, "card.unlist") }).click();
  await open(page, "nav.profile", lang);
  await expect(page.getByText(t(lang, "profile.card_off"))).toBeVisible();
}
