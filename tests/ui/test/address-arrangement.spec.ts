import { type MessageKey, t } from "@gigsync/core";
import { type GeoResult, Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { API, listWorker, newPhone, open, Role, RUN, shoot, signIn } from "./helpers.js";
import { openCard } from "./menu.js";

/**
 * Saved addresses and current location (ADR 0045) and work by the hour, the visit, the week or the month (ADR 0046):
 * a household saves its home from its location, asks for a maid for a few hours and sees each maid's hourly rate; a
 * worker says on her card which work she takes and a rate for each. The geocoder is stood in for at the network: the
 * tests' API has no Ola Maps key.
 */

const { en, hi, kn } = Lang.enum;
const FOLDER = "address-arrangement";
/** Banashankari 2nd Stage, outside the five pilot areas. */
const HERE = { latitude: 12.925311, longitude: 77.546722 };
const COARSE = { lat: 12.93, lon: 77.55 };
const LOCALITY = "Banashankari 2nd Stage";
const FOUND: GeoResult = {
  places: [
    {
      label: `12th Main, ${LOCALITY}, Bengaluru, Karnataka 560070, India`,
      locality: LOCALITY,
      city: "Bengaluru",
      pin: "560070",
      street: "12th Main",
      point: COARSE,
    },
  ],
};
const PHONE = { width: 400, height: 1400 };

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

/** A phone that may tell the page where it is, and whose reverse geocoding answers Banashankari. */
async function phoneHere(browser: { newContext: (o: object) => Promise<BrowserContext> }): Promise<Page> {
  const context = await browser.newContext({
    viewport: PHONE,
    deviceScaleFactor: 2,
    geolocation: HERE,
    permissions: ["geolocation"],
  });
  contexts.push(context);
  const page = await context.newPage();
  await page.route(`${API}/v1/geo/reverse**`, (route) => route.fulfill({ json: FOUND }));
  return page;
}

const log = (page: Page) => page.getByRole("log");
const chip = (page: Page, lang: Lang, key: MessageKey, params?: Record<string, string>) =>
  log(page).getByRole("button", { name: t(lang, key, params), exact: true });

test("a household saves its home from its location and asks for a maid by the hour", async ({ browser }) => {
  const maid = `Lakshmi ${RUN}`;
  await listWorker(maid, ["maid"], COARSE, 800_000, { area_name: LOCALITY, languages: ["kn", "en"] }, [
    { arrangement: "hourly", rate_paise: 18_000 },
    { arrangement: "monthly", rate_paise: 800_000 },
  ]);
  const page = await phoneHere(browser);
  await signIn(page, { role: Role.consumer, name: `Uma ${RUN}`, phone: newPhone(), lang: en });

  // Settings › Saved addresses › Add: the reason first, then the phone's position, then the form to check.
  await open(page, "nav.settings", en);
  await page.getByRole("button", { name: t(en, "addr.add"), exact: true }).click();
  const form = page.getByRole("form", { name: t(en, "addr.add") });
  await form.getByRole("button", { name: t(en, "addr.use_location"), exact: true }).click();
  await expect(page.getByRole("dialog", { name: t(en, "addr.why_title") })).toContainText(t(en, "addr.why"));
  await shoot("why-location", { household: page }, FOLDER);
  await page.getByRole("button", { name: t(en, "addr.allow"), exact: true }).click();
  await expect(form.getByRole("status")).toContainText(t(en, "addr.found", { area: LOCALITY }));
  await expect(form.getByLabel(t(en, "addr.area"), { exact: true })).toHaveValue(LOCALITY);
  await expect(form.getByLabel(t(en, "addr.pin"), { exact: true })).toHaveValue("560070");
  await form.getByLabel(t(en, "addr.house"), { exact: true }).fill("Flat 4B");
  await form.getByLabel(t(en, "addr.building"), { exact: true }).fill("Prestige Lakeside");
  await shoot("address-form", { household: page }, FOLDER);
  await form.getByRole("button", { name: t(en, "addr.save"), exact: true }).click();
  const book = page.getByRole("region", { name: t(en, "addr.title") });
  await expect(book).toContainText(`Flat 4B, Prestige Lakeside, 12th Main, ${LOCALITY}, Bengaluru 560070`);
  await shoot("saved-addresses", { household: page }, FOLDER);

  // Find: a maid, for a few hours, at home.
  await open(page, "nav.find", en);
  await chip(page, en, "need.pick_work").click();
  await chip(page, en, "trade.maid").click();
  await chip(page, en, "iv.skip").click();
  await expect(chip(page, en, "need.arr.hourly")).toBeVisible();
  await shoot("how-long", { household: page }, FOLDER);
  await chip(page, en, "need.arr.hourly").click();
  const home = chip(page, en, "addr.chip", { label: t(en, "addr.label.home"), area: LOCALITY });
  await expect(home).toBeVisible();
  await shoot("where", { household: page }, FOLDER);
  await home.click();
  await chip(page, en, "when.today").click();
  // The budget is per hour, beside the estimate for an hour.
  await expect(log(page)).toContainText(t(en, "need.budget_per.hour"));
  await expect(log(page)).toContainText(/an hour/);
  await shoot("budget-per-hour", { household: page }, FOLDER);
  const composer = page.getByRole("form", { name: t(en, "need.composer") });
  await composer.getByRole("textbox").fill("200");
  await composer.getByRole("button", { name: t(en, "a11y.send") }).click();
  await expect(log(page)).toContainText(
    t(en, "need.summary_arrangement", { arrangement: t(en, "arrangement.hourly") }),
  );
  await chip(page, en, "flag.yes").click();

  // The search sent a coarse point and the arrangement, and found the maid at her hourly rate.
  const found = page.getByRole("group", { name: t(en, "a11y.ask_workers") });
  const card = found.getByLabel(t(en, "a11y.worker", { name: maid }));
  await expect(card).toContainText(t(en, "price.per", { price: "₹180", unit: t(en, "unit.hour") }));
  await shoot("found-hourly", { household: page }, FOLDER);
});

for (const lang of [hi, kn]) {
  test(`Find asks how long the work is for, in ${lang}`, async ({ browser }) => {
    const page = await phoneHere(browser);
    await signIn(page, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone(), lang });
    await chip(page, lang, "need.pick_work").click();
    await chip(page, lang, "trade.driver").click();
    // A driver's first question is the route; skipped here.
    await chip(page, lang, "iv.skip").click();
    for (const a of ["hourly", "visit", "weekly", "monthly"] as const)
      await expect(chip(page, lang, `need.arr.${a}`)).toBeVisible();
    await shoot(`how-long-${lang}`, { household: page }, FOLDER);
    await chip(page, lang, "need.arr.weekly").click();
    // No saved address yet: "Add an address" leads the way, then the pilot areas.
    await expect(chip(page, lang, "addr.add")).toBeVisible();
    await expect(log(page)).toContainText(t(lang, "need.ask.address"));
  });
}

test("a maid says on her card which work she takes, with a rate for each, and how far she goes", async ({
  browser,
}) => {
  const page = await phoneHere(browser);
  await signIn(page, { role: Role.worker, name: `Meena ${RUN}`, phone: newPhone(), lang: en });
  await openCard(page, en);
  const form = page.getByRole("form", { name: t(en, "a11y.my_card") });
  await form.getByRole("button", { name: t(en, "trade.maid"), exact: true }).click();
  const work = form.getByRole("group", { name: t(en, "card.arrangements") });
  await work.getByLabel(t(en, "arrangement.hourly")).check();
  await work.getByLabel(t(en, "card.rate.hourly")).fill("180");
  await form.getByLabel(t(en, "card.rate.monthly")).fill("8000");
  await form.getByLabel(t(en, "card.min")).fill("6000");
  // Her area from her location, and five kilometres.
  await form.getByRole("button", { name: t(en, "card.use_location"), exact: true }).click();
  await page.getByRole("button", { name: t(en, "addr.allow"), exact: true }).click();
  await expect(form.getByText(t(en, "card.area_found", { area: LOCALITY }))).toBeVisible();
  await form.getByRole("button", { name: t(en, "card.km", { km: 5 }), exact: true }).click();
  await shoot("card-arrangements", { worker: page }, FOLDER);
  const sent = page.waitForRequest((r) => r.url() === `${API}/v1/board/profile` && r.method() === "PUT");
  await page.getByRole("button", { name: t(en, "card.publish"), exact: true }).click();
  const card = (await sent).postDataJSON();
  expect(card.area).toEqual(COARSE);
  expect(card.area_name).toBe(LOCALITY);
  expect(card.arrangements).toEqual([
    { arrangement: "hourly", rate_paise: 18_000 },
    { arrangement: "monthly", rate_paise: 800_000 },
  ]);
  await expect(page.getByRole("status").filter({ hasText: LOCALITY })).toBeVisible();
  await page.getByRole("button", { name: t(en, "card.unlist"), exact: true }).click();
});
