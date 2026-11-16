import { type MessageKey, t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { expect, type Page } from "@playwright/test";
import { type NeedAnswers, pickOnly, tellNeed } from "./findChat.js";
import { backToTabs, navRow, openCard, profileButton, shoot, textOf } from "./helpers.js";
import { closeMore, more } from "./jobs.js";

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
 * The worker publishes their card through My card's form (from the menu), in their language; `askFirst` ticks "ask me
 * first" for pets. The area is picked by its name in that language, as the worker reads it. The card has no UPI field:
 * that lives in About me alone. Publish and its status are in the dock.
 */
export async function publishCard(
  { page, lang }: Phone,
  card: { trade: string; area: AreaKey; rate: string; min: string; about: string; askFirst?: boolean },
) {
  await openCard(page, lang);
  const form = page.getByRole("form", { name: t(lang, "a11y.my_card") });
  await form.getByRole("button", { name: card.trade, exact: true }).click();
  await form.getByLabel(t(lang, "card.where")).selectOption({ label: t(lang, `area.${card.area}`) });
  // A maid's or driver's usual rate is for the main arrangement, monthly unless they pick others (ADR 0046).
  await form
    .getByLabel(t(lang, "card.rate"))
    .or(form.getByLabel(t(lang, "card.rate.monthly")))
    .fill(card.rate);
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
      await backToTabs(page, lang);
      await profileButton(page, lang).click({ timeout: CLEANUP_MS });
      await navRow(page, "nav.card", lang).click({ timeout: CLEANUP_MS });
      await page.getByRole("button", { name: t(lang, "shell.edit_card"), exact: true }).click({ timeout: CLEANUP_MS });
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

/**
 * The household asks in Find's chat: their need in their own words, then what the agent asks (the trade, the area, a
 * When chip, the detail if given, the budget), the time at the readback if given, and yes; then ticks only `worker`
 * among those found. The caller presses Ask after a screenshot.
 */
export async function fillAsk(phone: Phone, ask: NeedAnswers & { trade: string; worker: string }) {
  await tellNeed(phone, ask);
  await pickOnly(phone, ask.worker);
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
  const job = page.getByRole("article").filter({ has: page.getByRole("button", { name: t(lang, "job.more") }) });
  const box = (await more(job.first(), lang)).getByRole("form", { name: t(lang, "a11y.note") });
  await box.getByRole("textbox").fill(text);
  await box.getByRole("button", { name: t(lang, "job.send_note") }).click();
  await closeMore(job.first(), lang);
}
