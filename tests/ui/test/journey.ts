import { type MessageKey, t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { expect, type Page } from "@playwright/test";
import { openCard, shoot, tabs, textOf } from "./helpers.js";

/** A phone in a journey, with the language its owner chose. */
export interface Phone {
  page: Page;
  lang: Lang;
}

/** Cleaning up after a failed journey waits this long for each step, so a stuck page cannot hold the run. */
const CLEANUP_MS = 15_000;
/** Phones that put a card on the shared board in this test and have not taken it off yet. */
const listed = new Set<Phone>();

/** A pilot area by its key ("hsr_layout"), as the `area.*` strings name it. */
type AreaKey = Extract<MessageKey, `area.${string}`> extends `area.${infer K}` ? K : never;

/**
 * The worker publishes their card through My card (under Profile), in their language; `askFirst` ticks "ask me first"
 * for pets. The area is picked by its name in that language, as the worker reads it. The card has no UPI field: that
 * lives in Profile alone. Publish and its status are in the dock.
 */
export async function publishCard(
  { page, lang }: Phone,
  card: { trade: string; area: AreaKey; rate: string; min: string; about: string; askFirst?: boolean },
) {
  await openCard(page, lang);
  const form = page.getByRole("form", { name: t(lang, "a11y.my_card") });
  await form.getByRole("button", { name: card.trade, exact: true }).click();
  await form.getByLabel(t(lang, "card.where")).selectOption({ label: t(lang, `area.${card.area}`) });
  await form.getByLabel(t(lang, "card.rate")).fill(card.rate);
  await form.getByLabel(t(lang, "card.min")).fill(card.min);
  await form.getByLabel(t(lang, "card.about")).fill(card.about);
  if (card.askFirst) await form.getByLabel(t(lang, "card.ask_first", { item: t(lang, "detail.pets") })).check();
  await page.getByRole("button", { name: t(lang, "card.publish"), exact: true }).click();
  cleanUpLater({ page, lang });
  await expect(page.getByRole("status").filter({ hasText: textOf(lang, "card.on_board") })).toBeVisible();
}

/** Marks a phone whose card went on the board some other way (the card interview), for `unlistCards`. */
export function cleanUpLater(phone: Phone) {
  listed.add(phone);
}

/**
 * Takes off the board every card a journey published, for an `afterEach` before its contexts close. A journey that
 * ends well has already done it on screen; one that failed half-way would otherwise leave its worker on the shared
 * board, and enough of those at the same place and rate push the next run's worker out of the household's results.
 */
export async function unlistCards() {
  for (const { page, lang } of listed) {
    if (page.isClosed()) continue;
    try {
      await tabs(page, lang)
        .getByRole("button", { name: t(lang, "nav.profile") })
        .click({ timeout: CLEANUP_MS });
      await page.getByRole("button", { name: t(lang, "nav.card"), exact: true }).click({ timeout: CLEANUP_MS });
      const form = page.getByRole("form", { name: t(lang, "a11y.my_card") });
      await expect(form).toBeVisible({ timeout: CLEANUP_MS });
      const unlist = page.getByRole("button", { name: t(lang, "card.unlist") });
      // Shown only while the card is listed: a journey that finished has taken it off already.
      if (!(await unlist.isVisible())) continue;
      await unlist.click({ timeout: CLEANUP_MS });
      const off = page.getByRole("status").filter({ hasText: t(lang, "card.off_board") });
      await expect(off).toBeVisible({ timeout: CLEANUP_MS });
    } catch {
      // The page is gone or stuck; nothing more can be done from here.
    }
  }
  listed.clear();
}

/** Find's When chips that write a day the test can predict ("Pick a date" needs a date input). */
export type WhenChip = "when.today" | "when.tomorrow" | "when.daily";

/**
 * Find opens as a conversation; the journeys that test the form switch to it ("Use the form instead"). The choice
 * lasts until the app reloads or the owner signs out.
 */
export async function switchToForm({ page, lang }: Phone) {
  const search = page.getByRole("form", { name: t(lang, "a11y.search") });
  const toForm = page.getByRole("button", { name: t(lang, "need.use_form") });
  await expect(search.or(toForm)).toBeVisible();
  if (await toForm.isVisible()) await toForm.click();
  await expect(search).toBeVisible();
}

/**
 * The household switches to the form, searches, picks only `worker`, and fills the ask: the need, a When chip and, if
 * given, the time. The caller presses the dock's Ask button after a screenshot.
 */
export async function fillAsk(
  { page, lang }: Phone,
  ask: { trade: string; area: string; worker: string; need: string; when: WhenChip; time?: string; budget: string },
) {
  await switchToForm({ page, lang });
  const search = page.getByRole("form", { name: t(lang, "a11y.search") });
  await search.getByLabel(t(lang, "find.trade")).selectOption(ask.trade);
  await search.getByLabel(t(lang, "find.area")).selectOption(ask.area);
  await search.getByRole("button", { name: t(lang, "find.search") }).click();
  await expect(page.getByLabel(t(lang, "a11y.worker", { name: ask.worker }))).toBeVisible();
  for (const box of await page.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await page.getByRole("checkbox", { name: t(lang, "a11y.ask_worker", { name: ask.worker }) }).check();
  await page.getByLabel(t(lang, "find.need_label"), { exact: true }).fill(ask.need);
  const when = page.getByRole("group", { name: t(lang, "find.when") });
  await when.getByRole("button", { name: t(lang, ask.when), exact: true }).click();
  if (ask.time) await page.getByLabel(t(lang, "when.time")).fill(ask.time);
  await page.getByLabel(t(lang, "find.budget")).fill(ask.budget);
}

const signGroup = ({ page, lang }: Phone) => page.getByRole("group", { name: t(lang, "a11y.sign") });
/** The sign button by its words: a decision now starts with a "hear it again" button. */
const signButton = (phone: Phone) => signGroup(phone).getByRole("button", { name: textOf(phone.lang, "job.sign") });

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
  await signButton(a).click();
  await expect(signGroup(b)).toBeVisible();
  await shoot("one-signed", pages, folder);
  await signButton(b).click();
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
