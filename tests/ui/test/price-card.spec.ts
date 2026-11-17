import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { newPhone, Role, RUN, screenSizeShots, shoot, signIn, textOf } from "./helpers.js";
import { cleanUpLater, unlistCards } from "./journey.js";
import { nextTurn, type } from "./talk.js";

/**
 * "Your price" in the card chat (the design's board 10): each way the work is taken, ticked, with an amount for each,
 * the days and the part of the day on one card under the rate question, then the lowest on a card of its own that
 * stays on the phone.
 */

const { en } = Lang.enum;
const FOLDER = "price-card";
/** The design's phone, for the screenshots of the two cards. */
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 360, height: 780 };

test.afterEach(unlistCards);

const log = (page: Page) => page.getByRole("log");
const tap = (page: Page, name: string) => log(page).getByRole("button", { name, exact: true }).last().click();

test("a cook prices her work by the month and by the visit, with her days and mornings, and the summary says so", async ({
  page,
}) => {
  await signIn(page, { role: Role.worker, name: `Lakshmi ${RUN}`, phone: newPhone(), lang: en });
  cleanUpLater({ page, lang: en });
  await nextTurn(page, en, "iv.ask.also", () => type(page, en, "cook"));
  await nextTurn(page, en, "iv.ask.area", () => tap(page, t(en, "iv.done")));
  await nextTurn(page, en, "iv.ask.radius", () => tap(page, t(en, "area.koramangala")));
  await tap(page, t(en, "card.km", { km: 10 }));
  await nextTurn(page, en, "iv.ask.rate_ways", () => tap(page, t(en, "cardflow.use_km", { km: 10 })));

  // The card, not a list of notes: no "how sure" or rate-card lines in the chat.
  await expect(log(page).getByText(t(en, "cardflow.price_title"), { exact: true })).toBeVisible();
  await expect(log(page).getByText(/rate card|GigSync seed|How sure|Assumed, since not known/)).toHaveCount(0);

  // The ways she takes the work: the month a cook's card has always meant is ticked, the others not; a visit ticked
  // beside it brings an amount of its own, and the question above stays the same.
  const way = (key: MessageKey) => log(page).getByRole("button", { name: t(en, key), exact: true });
  await expect(way("cardflow.seg.monthly")).toHaveAttribute("aria-pressed", "true");
  await expect(way("cardflow.seg.visit")).toHaveAttribute("aria-pressed", "false");
  await way("cardflow.seg.visit").click();
  await expect(way("cardflow.seg.visit")).toHaveAttribute("aria-pressed", "true");
  await expect(way("cardflow.seg.monthly")).toHaveAttribute("aria-pressed", "true");
  await expect(log(page).getByText(textOf(en, "iv.ask.rate_ways"))).toHaveCount(1);
  const amountFor = (unit: "visit" | "monthly") =>
    log(page).getByLabel(t(en, "cardflow.amount_per", { per: t(en, `cardflow.per.${unit}`) }));

  // ₹300 a visit; ₹4,000 a month typed, then one step up: ₹4,500.
  await amountFor("visit").fill("300");
  await amountFor("monthly").fill("4000");
  await log(page)
    .getByRole("button", { name: t(en, "cardflow.more", { step: "₹500" }) })
    .click();
  await expect(amountFor("monthly")).toHaveValue("4500");
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

  await nextTurn(page, en, "iv.ask.min", () => tap(page, t(en, "cardflow.prices_next")));
  await expect(
    log(page).getByText("₹300 / visit, ₹4,500 / month · Mon, Tue, Wed, Thu, Fri, Sat · Morning"),
  ).toBeVisible();
  // The lowest is its own card, private.
  const lowest = log(page).getByLabel(t(en, "cardflow.lowest_title"));
  await expect(log(page).getByText(t(en, "cardflow.private")).last()).toBeVisible();
  await lowest.fill("4000");
  await shoot("lowest-card", { worker: page }, FOLDER);
  await nextTurn(page, en, "iv.ask.languages", () => tap(page, t(en, "cardflow.lowest_next")));

  // Languages tick on and off where they stand, ticked with a tick; Done answers with those ticked.
  const language = (key: MessageKey) =>
    log(page)
      .getByRole("button", { name: t(en, key), exact: true })
      .last();
  await language("lang.hi").click();
  await language("lang.kn").click();
  await language("lang.kn").click();
  await expect(language("lang.hi")).toHaveAttribute("aria-pressed", "true");
  await expect(language("lang.kn")).toHaveAttribute("aria-pressed", "false");
  await expect(log(page).getByText(textOf(en, "iv.ask.about"))).toHaveCount(0);
  await shoot("languages-picked", { worker: page }, FOLDER);
  await nextTurn(page, en, "iv.ask.about", () => tap(page, t(en, "iv.done")));
  await expect(log(page).getByText(t(en, "lang.hi"), { exact: true }).last()).toBeVisible();

  // The rest as any card: nothing about the work, no asking first, no list, the agent waits.
  await nextTurn(page, en, "iv.ask.ask_first", () => tap(page, t(en, "iv.skip")));
  await nextTurn(page, en, "iv.ask.asks", () => tap(page, t(en, "flag.no")));
  await nextTurn(page, en, "iv.ask.auto", () => tap(page, t(en, "iv.skip")));
  await nextTurn(page, en, "iv.confirm", () => tap(page, t(en, "flag.no")));
  await expect(log(page)).toContainText(textOf(en, "iv.summary", { rate: "₹4,500" }));
  // The visit's own rate, from the price card: no question asked it again.
  await expect(log(page)).toContainText("₹300");
  await expect(log(page)).toContainText(t(en, "iv.summary_days", { days: "Mon, Tue, Wed, Thu, Fri, Sat" }));
  await expect(log(page)).toContainText(t(en, "iv.summary_window", { window: t(en, "terms.window.morning") }));
});
