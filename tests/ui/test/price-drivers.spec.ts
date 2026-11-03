import { priceText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { API, newPhone, open, Role, RUN, shoot, signIn, textOf } from "./helpers.js";

/**
 * ADR 0041 through the real screens: a household types "4 BHK villa painting, outside too, 2 floors" in Find and is
 * asked only what still moves the price (who buys the paint, the area, the finish), then sees a range with how sure
 * it is and what it rests on. The test stack has no phone model (lite mode: the fixed questions), and estimates use
 * no cloud model: with no painting jobs on GigSync the range rests on the Bengaluru rate card alone, whose painting
 * figures are a GigSync seed; nothing needs seeding. The phone sends one estimate request for the job, after the last
 * answer.
 */

const { en } = Lang.enum;
const FOLDER = "price-drivers";
const VILLA = "4 BHK villa painting, outside too, 2 floors";
const ESTIMATES = `${API}/v1/estimates`;
const RUPEE = 100;

/** The chat's box. */
async function say(page: Page, words: string) {
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
}

const tap = (page: Page, label: string) =>
  page.getByRole("log").getByRole("button", { name: label, exact: true }).last().click();
const line = (page: Page, key: Parameters<typeof textOf>[1], params = {}) =>
  page.getByText(textOf(en, key, params)).last();

/** Counts the estimate requests a page sends. */
function countEstimates(page: Page): { count: number } {
  const seen = { count: 0 };
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().startsWith(ESTIMATES)) seen.count += 1;
  });
  return seen;
}

/** A household in Find, after the villa sentence and its area. */
async function villaAsked(page: Page) {
  await signIn(page, { role: Role.consumer, name: `Asha ${RUN}`, phone: newPhone(), address: "HSR", lang: en });
  await open(page, "nav.find");
  await expect(page.getByRole("log")).toContainText(t(en, "need.start"));
  await say(page, VILLA);
  // A long description is read into chips to confirm first (ADR 0033 §5): "4 rooms".
  await tap(page, t(en, "terms.scope_ok"));
  await tap(page, t(en, "area.hsr_layout"));
  await expect(line(page, "driver.ask.paint_by")).toBeVisible();
}

test("a household describing a villa is asked what moves the price, then sees a range with how sure it is", async ({
  page,
}) => {
  const sent = countEstimates(page);
  await villaAsked(page);
  // Rooms, villa, both surfaces and two floors came from the words: never asked.
  for (const asked of ["driver.ask.rooms", "driver.ask.surface", "driver.ask.floors", "driver.ask.house_type"] as const)
    await expect(page.getByRole("log")).not.toContainText(t(en, asked));
  await shoot("asked-paint", { household: page }, FOLDER);
  await tap(page, t(en, "driver.value.paint_by.household"));
  await expect(line(page, "driver.ask.area_sqft")).toBeVisible();
  await say(page, "about 3000 sq ft");
  await expect(line(page, "driver.ask.finish")).toBeVisible();
  await tap(page, t(en, "driver.value.finish.plain"));
  await tap(page, t(en, "when.tomorrow"));
  await tap(page, t(en, "when.any_time"));

  // 3,000 sq ft × (inside + 0.88 outside) × 1.15 (villa) × 0.4 (labour only) = 2,594 units at ₹40–₹65.
  await expect(line(page, "need.ask.budget")).toBeVisible();
  const range = { low: priceText(103_780 * RUPEE), high: priceText(168_640 * RUPEE) };
  await expect(page.getByRole("log")).toContainText(range.low);
  await expect(page.getByRole("log")).toContainText(range.high);
  await expect(line(page, "driver.confidence_line", { level: t(en, "driver.confidence.medium") })).toBeVisible();
  const card = t(en, "driver.basis.rate_card", { city: t(en, "city.bengaluru"), sources: "GigSync seed, unverified" });
  await expect(line(page, "driver.basis_line", { parts: card })).toBeVisible();
  await shoot("range", { household: page }, FOLDER);
  expect(sent.count).toBe(1);
});

test("'I don't know' ends the questions, and the range says what it assumed and mostly depends on", async ({
  page,
}) => {
  const sent = countEstimates(page);
  await villaAsked(page);
  await tap(page, t(en, "driver.dont_know"));
  await tap(page, t(en, "when.tomorrow"));
  await tap(page, t(en, "when.any_time"));
  await expect(line(page, "need.ask.budget")).toBeVisible();
  await expect(line(page, "driver.confidence_line", { level: t(en, "driver.confidence.low") })).toBeVisible();
  await expect(line(page, "driver.spread", { driver: t(en, "driver.noun.paint_by") })).toBeVisible();
  await expect(page.getByRole("log")).toContainText(t(en, "driver.noun.finish"));
  await shoot("assumed", { household: page }, FOLDER);
  expect(sent.count).toBe(1);
});
