import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { newPhone, Role, RUN, screenSizeShots, shoot, signIn, textOf } from "./helpers.js";
import { cleanUpLater, unlistCards } from "./journey.js";
import { nextTurn, type } from "./talk.js";

/**
 * "Your price" in the card chat (the design's board 10): how the work is priced, one amount, the days and the part of
 * the day on one card under the rate question, then the lowest on a card of its own that stays on the phone.
 */

const { en } = Lang.enum;
const FOLDER = "price-card";
/** The design's phone, for the screenshots of the two cards. */
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 360, height: 780 };

test.afterEach(unlistCards);

const log = (page: Page) => page.getByRole("log");
const tap = (page: Page, name: string) => log(page).getByRole("button", { name, exact: true }).last().click();

test("a cook prices her work by the month on the price card, with her days and mornings, and the summary says so", async ({
  page,
}) => {
  await signIn(page, { role: Role.worker, name: `Lakshmi ${RUN}`, phone: newPhone(), lang: en });
  cleanUpLater({ page, lang: en });
  await nextTurn(page, en, "iv.ask.also", () => type(page, en, "cook"));
  await nextTurn(page, en, "iv.ask.area", () => tap(page, t(en, "iv.done")));
  await nextTurn(page, en, "iv.ask.radius", () => tap(page, t(en, "area.koramangala")));
  await tap(page, t(en, "card.km", { km: 10 }));
  await nextTurn(page, en, "iv.ask.rate_month", () => tap(page, t(en, "cardflow.use_km", { km: 10 })));

  // The card, not a list of notes: no "how sure" or rate-card lines in the chat.
  await expect(log(page).getByText(t(en, "cardflow.price_title"), { exact: true })).toBeVisible();
  await expect(log(page).getByText(textOf(en, "driver.basis_line"))).toHaveCount(0);

  // Another way of pricing changes the card's unit, never the question above it; back to the month.
  const segment = (key: MessageKey) => log(page).getByRole("button", { name: t(en, key), exact: true });
  await segment("cardflow.seg.visit").click();
  await expect(segment("cardflow.seg.visit")).toHaveAttribute("aria-pressed", "true");
  await expect(log(page).getByText(t(en, "cardflow.per.visit"), { exact: true })).toBeVisible();
  await expect(log(page)).not.toContainText(textOf(en, "iv.ask.rate_visit"));
  await expect(log(page).getByText(textOf(en, "iv.ask.rate_month"))).toHaveCount(1);
  await segment("cardflow.seg.monthly").click();
  await expect(segment("cardflow.seg.monthly")).toHaveAttribute("aria-pressed", "true");

  // ₹4,000 typed, then one step up: ₹4,500 a month.
  const amount = log(page).getByLabel(t(en, "cardflow.amount"));
  await amount.fill("4000");
  await log(page)
    .getByRole("button", { name: t(en, "cardflow.more", { step: "₹500" }) })
    .click();
  await expect(amount).toHaveValue("4500");
  // Monday to Saturday: every day is picked to start with, so Sunday is tapped off. Mornings.
  await tap(page, t(en, "day.7"));
  await expect(log(page).getByRole("button", { name: t(en, "day.7"), exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await tap(page, t(en, "cardflow.window.morning"));

  await page.setViewportSize(PHONE);
  screenSizeShots.add(page);
  await log(page).getByText(t(en, "cardflow.price_title"), { exact: true }).scrollIntoViewIfNeeded();
  await shoot("price-card", { worker: page }, FOLDER);
  // The narrowest phone in the pilot: the card still fits, nothing wraps out of its row.
  await page.setViewportSize(NARROW);
  await log(page).getByText(t(en, "cardflow.price_title"), { exact: true }).scrollIntoViewIfNeeded();
  await shoot("price-card-360", { worker: page }, FOLDER);
  await page.setViewportSize(PHONE);

  await nextTurn(page, en, "iv.ask.min", () => tap(page, t(en, "cardflow.price_next")));
  await expect(log(page).getByText("₹4,500 / month · Mon, Tue, Wed, Thu, Fri, Sat · Morning")).toBeVisible();
  // The lowest is its own card, private.
  const lowest = log(page).getByLabel(t(en, "cardflow.lowest_title"));
  await expect(log(page).getByText(t(en, "cardflow.private")).last()).toBeVisible();
  await lowest.fill("4000");
  await shoot("lowest-card", { worker: page }, FOLDER);
  await nextTurn(page, en, "iv.ask.languages", () => tap(page, t(en, "cardflow.lowest_next")));

  // The rest as any card: no other languages, nothing about the work, no asking first, no list, the agent waits.
  await nextTurn(page, en, "iv.ask.about", () => tap(page, t(en, "iv.none")));
  await nextTurn(page, en, "iv.ask.ask_first", () => tap(page, t(en, "iv.skip")));
  await nextTurn(page, en, "iv.ask.asks", () => tap(page, t(en, "flag.no")));
  await nextTurn(page, en, "iv.ask.auto", () => tap(page, t(en, "iv.skip")));
  await nextTurn(page, en, "iv.confirm", () => tap(page, t(en, "flag.no")));
  await expect(log(page)).toContainText(textOf(en, "iv.summary", { rate: "₹4,500" }));
  await expect(log(page)).toContainText(t(en, "iv.summary_days", { days: "Mon, Tue, Wed, Thu, Fri, Sat" }));
  await expect(log(page)).toContainText(t(en, "iv.summary_window", { window: t(en, "terms.window.morning") }));
});
