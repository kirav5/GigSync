import { ASKED_RADIUS_KM, t } from "@gigsync/core";
import { Lang, MAX_TRADES } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { plainMap } from "./address.js";
import { newPhone, Role, RUN, shoot, signIn } from "./helpers.js";

/**
 * A worker with no card picks their work as chips before the card chat (start/WorkStep.tsx), and the chat starts from
 * it: it says what was picked and goes on to the details, never asking "What work do you do?" again.
 */

const en = Lang.enum.en;
const FOLDER = "work-step";
/** A distance set on the slider, not one of the quick chips. */
const OWN_KM = 12;
/** The nearer quick chip under the map. */
const NEAR_KM = 5;
/** A phone's height, short enough that an answer drawn under the composer would be hidden there. */
const PHONE = { width: 400, height: 800 };

const chip = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const log = (page: Page) => page.getByRole("log");
const continueWith = (n: number) => t(en, "work.continue", { n, max: MAX_TRADES });

test("work picked as chips starts the card chat without asking the work again", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Lakshmi ${RUN}`, phone: newPhone(), pickWork: true });
  await chip(page, t(en, "trade.maid")).click();
  await chip(page, t(en, "trade.cook")).click();
  await expect(chip(page, t(en, "trade.maid"))).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: continueWith(2), exact: true }).click();

  const work = [t(en, "trade.maid"), t(en, "trade.cook")].join(", ");
  await expect(log(page)).toContainText(t(en, "iv.picked_work", { work }));
  await expect(log(page)).not.toContainText(t(en, "iv.ask.trade"));
});

test("the search finds a kind by its name or an everyday word, and keeps what was picked", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Savitha ${RUN}`, phone: newPhone(), pickWork: true });
  // Every kind is on the page under its group, as chips.
  await chip(page, t(en, "category.babysitter")).click();
  const search = page.getByRole("searchbox");
  await search.fill("tv");
  await expect(chip(page, t(en, "category.babysitter"))).toHaveCount(0);
  await chip(page, t(en, "category.tv_repair")).click();
  // "cleaning" is no kind's name, but it is what Maid does.
  await search.fill("cleaning");
  await expect(chip(page, t(en, "trade.maid"))).toBeVisible();
  await search.fill("");

  await expect(chip(page, t(en, "category.tv_repair"))).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: continueWith(2), exact: true }).click();
  const work = [t(en, "category.babysitter"), t(en, "category.tv_repair")].join(", ");
  await expect(log(page)).toContainText(t(en, "iv.picked_work", { work }));
});

test("work the list does not name goes on in the worker's words, and the chat settles its kind", async ({ page }) => {
  const words = "i sharpen wood";
  const carpenter = t(en, "trade.carpenter");
  await signIn(page, { role: Role.worker, name: `Ramesh ${RUN}`, phone: newPhone(), pickWork: true });
  const search = page.getByRole("searchbox");
  await expect(search).toHaveAttribute("placeholder", t(en, "work.search"));
  // "wood" names no kind, but it is what a carpenter works with.
  await search.fill("wood");
  await expect(page.getByText(t(en, "work.closest"))).toBeVisible();
  await expect(chip(page, carpenter)).toBeVisible();
  await search.fill(words);
  await expect(chip(page, carpenter)).toBeVisible();
  await shoot("own-words", { worker: page }, FOLDER);
  await chip(page, t(en, "work.add", { words })).click();
  await search.fill("");
  await expect(chip(page, words)).toHaveAttribute("aria-pressed", "true");
  await shoot("own-words-picked", { worker: page }, FOLDER);
  await page.getByRole("button", { name: continueWith(1), exact: true }).click();

  // The chat asks which kind the words are closest to, with the same guess, and settles it with a tap.
  await expect(log(page)).toContainText(t(en, "iv.custom_one", { words, work: carpenter }));
  await expect(log(page)).not.toContainText(t(en, "iv.ask.trade"));
  await shoot("chat-asks-closest", { worker: page }, FOLDER);
  await log(page).getByRole("button", { name: carpenter, exact: true }).last().click();
  await expect(log(page)).toContainText(t(en, "iv.custom_filed", { work: carpenter }));

  // Then the area, and how far they go: a map with a slider, starting at 10 km, which a quick chip sets. On a phone's
  // height the whole answer comes into view above the composer, the map that loads late included.
  await plainMap(page);
  await page.setViewportSize(PHONE);
  await log(page)
    .getByRole("button", { name: t(en, "area.jayanagar"), exact: true })
    .last()
    .click();
  await expect(log(page)).toContainText(t(en, "iv.ask.radius"));
  const slider = log(page).getByRole("slider", { name: t(en, "card.radius"), exact: true });
  await expect(slider).toHaveValue(String(ASKED_RADIUS_KM));
  await expect(
    log(page).getByRole("img", {
      name: t(en, "map.radius_of", { km: ASKED_RADIUS_KM, place: t(en, "area.jayanagar") }),
    }),
  ).toBeVisible();
  const lastChip = chip(page, t(en, "card.km", { km: ASKED_RADIUS_KM })).last();
  const composer = page.getByRole("form", { name: t(en, "nav.talk"), exact: true });
  await expect(async () => {
    const [answer, foot] = await Promise.all([lastChip.boundingBox(), composer.boundingBox()]);
    expect(answer && foot && answer.y + answer.height <= foot.y).toBe(true);
  }).toPass();
  // A quick chip only sets the slider, the circle and the distance shown: nothing is answered until Use.
  await chip(page, t(en, "card.km", { km: NEAR_KM }))
    .last()
    .click();
  await expect(slider).toHaveValue(String(NEAR_KM));
  await expect(chip(page, t(en, "card.km", { km: NEAR_KM })).last()).toHaveAttribute("aria-pressed", "true");
  await expect(
    log(page).getByRole("img", { name: t(en, "map.radius_of", { km: NEAR_KM, place: t(en, "area.jayanagar") }) }),
  ).toBeVisible();
  await expect(log(page)).not.toContainText(t(en, "iv.got_radius", { km: NEAR_KM }));
  await expect(log(page).getByRole("button", { name: t(en, "cardflow.use_km", { km: NEAR_KM }) })).toBeVisible();
  await slider.fill(String(OWN_KM));
  await shoot("chat-asks-radius", { worker: page }, FOLDER);
  await log(page)
    .getByRole("button", { name: t(en, "cardflow.use_km", { km: OWN_KM }), exact: true })
    .click();
  await expect(log(page)).toContainText(t(en, "iv.got_radius", { km: OWN_KM }));
  await expect(log(page)).toContainText(t(en, "iv.ask.rate_visit"));
  await shoot("chat-asks-rate", { worker: page }, FOLDER);
});
