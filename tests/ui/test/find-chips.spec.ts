import { type ApiClient, type MessageKey, t } from "@gigsync/core";
import { groupOf, Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { API, listWorker, newPhone, Role, RUN, shoot, signIn } from "./helpers.js";

/**
 * With no model to read words, Find serves with chips only (ADR 0064): no sentence can be typed or said, the need
 * opens on the list of work, a repair's "what is wrong?" is asked as the kinds of problem, and the answers that are
 * numbers (how many, the budget) keep a number field. The whole need is given that way, up to the workers found.
 */

const { en } = Lang.enum;
const HSR = { lat: 12.9116, lon: 77.6474 };
const AREA = "HSR Layout";
const RATE_PAISE = 65_000;
const FOLDER = "find-chips";
const TRADE = "electrician";

let listed: ApiClient[] = [];

test.afterAll(async () => {
  await Promise.all(listed.map((api) => api.removeProfile()));
  listed = [];
});

/** Taps a choice under the newest question. */
const tap = (page: Page, key: MessageKey, params?: Record<string, string>) =>
  page
    .getByRole("log")
    .getByRole("button", { name: t(en, key, params), exact: true })
    .last()
    .click();

/** Where answers are given, below the chat. */
const box = (page: Page) => page.getByRole("form", { name: t(en, "need.composer") });

/** Types a number into the number field and sends it. */
async function number(page: Page, digits: string) {
  const field = box(page).getByRole("textbox", { name: t(en, "need.number_placeholder") });
  await field.fill(digits);
  await box(page)
    .getByRole("button", { name: t(en, "a11y.send") })
    .click();
}

test("with no model, a household gives a whole need by chips and numbers, and finds a worker", async ({ page }) => {
  const worker = `Ravi Chips ${RUN}`;
  listed.push(await listWorker(worker, [TRADE], HSR, RATE_PAISE, { area_name: AREA, languages: [en] }));
  // This phone's API has no model, as the test API says by itself: nothing can read a sentence.
  await page.route(`${API}/v1/model/status`, (route) => route.fulfill({ json: { on: false } }));
  await signIn(page, {
    role: Role.consumer,
    name: `Meena Chips ${RUN}`,
    phone: newPhone(),
    address: "Flat 4, 2nd Main",
    area: AREA,
    lang: en,
  });

  // The need opens on the groups of work, with no invitation to say it, no field and no mic.
  const log = page.getByRole("log");
  await expect(log).toContainText(t(en, "need.pick_group"));
  await expect(log).not.toContainText(t(en, "need.start"));
  await expect(page.getByText(t(en, "need.no_typing"), { exact: true })).toBeVisible();
  await expect(box(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: t(en, "speech.listen") })).toHaveCount(0);
  await shoot("groups", { household: page }, FOLDER);

  await tap(page, `group.${groupOf(TRADE)}`);
  await tap(page, `trade.${TRADE}`);

  // What is wrong, as the kinds of problem the estimate knows; never a box to describe it in.
  await expect(log).toContainText(t(en, "question.problem"));
  await expect(log.getByRole("button", { name: t(en, "iv.skip"), exact: true })).toHaveCount(0);
  await expect(box(page)).toHaveCount(0);
  await shoot("problem", { household: page }, FOLDER);
  await tap(page, "driver.value.problem.fan");

  await expect(log).toContainText(t(en, "need.ask.address"));
  await tap(page, "addr.chip", { label: t(en, "addr.label.home"), area: AREA });

  // How many: a number, which code reads, so it has a number field beside its chips.
  await expect(log).toContainText(t(en, "driver.ask.points.electrician"));
  await expect(page.getByText(t(en, "need.no_typing_number"), { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: t(en, "speech.listen") })).toHaveCount(0);
  await number(page, "2");

  await expect(log).toContainText(t(en, "need.ask.when"));
  await expect(box(page)).toHaveCount(0);
  await tap(page, "when.tomorrow");
  await expect(log).toContainText(t(en, "need.ask.hour"));
  await tap(page, "when.any_time");

  await expect(log).toContainText(t(en, "need.ask.budget"));
  await shoot("budget", { household: page }, FOLDER);
  await number(page, "700");

  // The readback carries what is wrong, though nothing was typed; the yes is a chip too.
  await expect(log).toContainText(t(en, "need.summary", { trade: "Electrician", area: AREA, when: "Tomorrow" }));
  await expect(log).toContainText(t(en, "driver.value.problem.fan"));
  await expect(log).toContainText(t(en, "need.summary_budget", { budget: "₹700" }));
  await expect(box(page)).toHaveCount(0);
  await shoot("readback", { household: page }, FOLDER);
  await tap(page, "flag.yes");

  const found = page.getByRole("group", { name: t(en, "a11y.ask_workers") });
  await expect(found.getByLabel(t(en, "a11y.worker", { name: worker }))).toBeVisible();
  await shoot("found", { household: page }, FOLDER);
});
