import { t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { expect, type Page } from "@playwright/test";
import { shoot } from "./helpers.js";

/** A phone in a journey, with the language its owner chose. */
export interface Phone {
  page: Page;
  lang: Lang;
}

/** The worker publishes their card through My card, in their language; `askFirst` ticks "ask me first" for pets. */
export async function publishCard(
  { page, lang }: Phone,
  card: { trade: string; area: string; rate: string; min: string; vpa: string; about: string; askFirst?: boolean },
) {
  const form = page.getByRole("form", { name: t(lang, "a11y.my_card") });
  await form.getByRole("button", { name: card.trade, exact: true }).click();
  await form.getByLabel(t(lang, "card.where")).selectOption(card.area);
  await form.getByLabel(t(lang, "card.rate")).fill(card.rate);
  await form.getByLabel(t(lang, "card.min")).fill(card.min);
  await form.getByLabel(t(lang, "card.vpa")).fill(card.vpa);
  await form.getByLabel(t(lang, "card.about")).fill(card.about);
  if (card.askFirst) await form.getByLabel(t(lang, "card.ask_first", { item: t(lang, "detail.pets") })).check();
  await form.getByRole("button", { name: t(lang, "card.publish") }).click();
  await expect(form.locator(".label.fresh")).toBeVisible();
}

/** The household searches, picks only `worker`, and fills the ask; the caller presses the button after a screenshot. */
export async function fillAsk(
  { page, lang }: Phone,
  ask: { trade: string; area: string; worker: string; need: string; when: string; budget: string },
) {
  const search = page.getByRole("form", { name: t(lang, "a11y.search") });
  await search.getByLabel(t(lang, "find.trade")).selectOption(ask.trade);
  await search.getByLabel(t(lang, "find.area")).selectOption(ask.area);
  await search.getByRole("button", { name: t(lang, "find.search") }).click();
  await expect(page.getByLabel(t(lang, "a11y.worker", { name: ask.worker }))).toBeVisible();
  for (const box of await page.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await page.getByRole("checkbox", { name: t(lang, "a11y.ask_worker", { name: ask.worker }) }).check();
  await page.getByLabel(t(lang, "find.need_label"), { exact: true }).fill(ask.need);
  await page.getByLabel(t(lang, "find.when"), { exact: true }).fill(ask.when);
  await page.getByLabel(t(lang, "find.budget")).fill(ask.budget);
}

const signGroup = ({ page, lang }: Phone) => page.getByRole("group", { name: t(lang, "a11y.sign") });

/** Each owner signs when their phone asks, in their language: whichever agent accepted first, then the other. */
export async function signBoth(phones: Record<string, Phone>, folder: string) {
  const all = Object.values(phones);
  const pages = Object.fromEntries(Object.entries(phones).map(([k, p]) => [k, p.page]));
  await expect(async () => {
    const seen = await Promise.all(all.map((p) => signGroup(p).isVisible()));
    expect(seen.some(Boolean)).toBe(true);
  }).toPass();
  const first = (await Promise.all(all.map((p) => signGroup(p).isVisible()))).indexOf(true);
  const [a, b] = [all[first] as Phone, all[1 - first] as Phone];
  await shoot("agents-agree", pages, folder);
  await signGroup(a).getByRole("button").first().click();
  await expect(signGroup(b)).toBeVisible();
  await shoot("one-signed", pages, folder);
  await signGroup(b).getByRole("button").first().click();
}

/** The signed price in paise, read from the deal line in any language ("₹9,200"). */
export async function dealPaise({ page, lang }: Phone): Promise<number> {
  const text = (await page.getByLabel(t(lang, "a11y.deal")).textContent()) ?? "";
  return Number(text.match(/₹([\d,]+)/)?.[1]?.replaceAll(",", "")) * 100;
}

/** The worker sends their own words from the note box under a signed job. */
export async function sendNote({ page, lang }: Phone, text: string) {
  const box = page.getByRole("form", { name: t(lang, "a11y.note") });
  await box.getByRole("textbox").fill(text);
  await box.getByRole("button", { name: t(lang, "job.send_note") }).click();
}
