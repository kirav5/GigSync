import { type MessageKey, t } from "@gigsync/core";
import { type GeoResult, Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { addressSave, doorField, plainMap } from "./address.js";
import { say } from "./findChat.js";
import { API, newPhone, Role, RUN, shoot, signIn } from "./helpers.js";
import { openCard } from "./menu.js";

/**
 * Addresses by chat, the hour a household books, and a worker's days (ADR 0050): Find's header shows the address in
 * use; "change my address" opens the address turn in the chat, where the household picks one, uses where they are or
 * adds one; a place outside the cities GigSync serves is refused. After the day, Find asks the hour. A worker ticks
 * the days they work on My card.
 */

const { en } = Lang.enum;
const FOLDER = "address-chat";
const PHONE = { width: 400, height: 1400 };
const BANASHANKARI = { latitude: 12.925311, longitude: 77.546722 };
const MYSURU = { latitude: 12.3052, longitude: 76.6552 };
const place = (locality: string, city: string, pin: string, lat: number, lon: number): GeoResult => ({
  places: [{ label: `${locality}, ${city} ${pin}`, locality, city, pin, point: { lat, lon } }],
});
const FOUND = {
  bengaluru: place("Banashankari 2nd Stage", "Bengaluru", "560070", 12.93, 77.55),
  mysuru: place("Saraswathipuram", "Mysuru", "570009", 12.31, 76.66),
};
const say_ = (key: MessageKey, params?: Record<string, string>) => t(en, key, params);

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

/** A phone at `where`, whose place the server names as `found`. */
async function phoneAt(
  browser: { newContext: (o: object) => Promise<BrowserContext> },
  where: object,
  found: GeoResult,
) {
  const context = await browser.newContext({ viewport: PHONE, geolocation: where, permissions: ["geolocation"] });
  contexts.push(context);
  const page = await context.newPage();
  await page.route(`${API}/v1/geo/reverse**`, (route) => route.fulfill({ json: found }));
  await plainMap(page);
  return page;
}

const desk = (page: Page) => page.getByRole("region", { name: say_("addr.title") });
const header = (page: Page) => page.getByRole("button", { name: /Address in use|Add your address/ });

test("the address in use is at the top, and the chat changes it", async ({ browser }) => {
  const page = await phoneAt(browser, BANASHANKARI, FOUND.bengaluru);
  await signIn(page, {
    role: Role.consumer,
    name: `Kavya ${RUN}`,
    phone: newPhone(),
    address: "Flat 2",
    area: "Koramangala",
  });
  await expect(header(page)).toContainText(say_("addr.label.home"));
  await header(page).scrollIntoViewIfNeeded();
  await shoot("header", { household: page }, FOLDER);

  await say({ page, lang: en }, "change my address");
  await expect(desk(page)).toContainText(say_("addr.desk"));
  await shoot("asked", { household: page }, FOLDER);

  // Where they are now: the reason first, then the place found, then the flat number and a label.
  await desk(page)
    .getByRole("button", { name: say_("addr.use_location"), exact: true })
    .click();
  await page.getByRole("button", { name: say_("addr.allow"), exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Banashankari 2nd Stage" })).toBeVisible();
  // The door on a map: the pin stays in the middle and the map moves under it.
  await expect(page.getByRole("img", { name: say_("map.of", { place: "Banashankari 2nd Stage" }) })).toBeVisible();
  await expect(page.getByText(say_("map.move_pin"))).toBeVisible();
  const form = page.getByRole("form", { name: say_("addr.add") });
  await doorField(form, en).fill("No. 45");
  await form.getByText(say_("addr.label.work"), { exact: true }).click();
  await shoot("located", { household: page }, FOLDER);
  await addressSave(form, en).click();
  await expect(desk(page)).toBeHidden();
  await expect(header(page)).toContainText(say_("addr.label.work"));
  await expect(header(page)).toContainText("No. 45, Banashankari 2nd Stage");
  await expect(page.getByRole("log")).toContainText(
    say_("addr.using", { label: say_("addr.label.work"), area: "Banashankari 2nd Stage" }),
  );
  await header(page).scrollIntoViewIfNeeded();
  await shoot("changed", { household: page }, FOLDER);
});

test("a place outside the cities GigSync serves is not saved, and the chat says so", async ({ browser }) => {
  const page = await phoneAt(browser, MYSURU, FOUND.mysuru);
  await signIn(page, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone() });
  await expect(header(page)).toContainText(say_("addr.header_none"));
  await header(page).click();
  await desk(page)
    .getByRole("button", { name: say_("addr.use_location"), exact: true })
    .click();
  await page.getByRole("button", { name: say_("addr.allow"), exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(say_("addr.not_served"));
  await shoot("not-served", { household: page }, FOLDER);
});

test("after the day, Find asks the hour, with only hours still ahead today", async ({ browser }) => {
  const page = await phoneAt(browser, BANASHANKARI, FOUND.bengaluru);
  await signIn(page, {
    role: Role.consumer,
    name: `Asha ${RUN}`,
    phone: newPhone(),
    address: "Flat 9",
    area: "Jayanagar",
  });
  await say({ page, lang: en }, "Need an electrician tomorrow, the fan is not working");
  const hours = page.getByRole("log");
  const asked = (key: MessageKey) => page.getByRole("log").getByText(say_(key)).last();
  // The questions before the hour: where (her saved address) and the price question ("don't know").
  const before = [
    { key: "need.ask.address", chip: say_("addr.chip", { label: say_("addr.label.home"), area: "Jayanagar" }) },
    { key: "driver.dont_know", chip: say_("driver.dont_know") },
  ] as const;
  for (let i = 0; i < before.length + 1 && !(await asked("need.ask.hour").isVisible()); i++) {
    await expect(
      asked("need.ask.hour")
        .or(hours.getByRole("button", { name: before[0].chip }).last())
        .or(hours.getByRole("button", { name: before[1].chip }).last()),
    ).toBeVisible();
    for (const b of before) {
      const chip = hours.getByRole("button", { name: b.chip, exact: true }).last();
      if (await chip.isVisible()) await chip.click();
    }
  }
  await expect(asked("need.ask.hour")).toBeVisible();
  await expect(hours.getByRole("button", { name: "10 am", exact: true }).last()).toBeVisible();
  await expect(hours.getByRole("button", { name: say_("when.any_time"), exact: true }).last()).toBeVisible();
  await shoot("hours", { household: page }, FOLDER);
});

test("a worker ticks the days they work, shown on the card for households", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Meena ${RUN}`, phone: newPhone() });
  await openCard(page, en);
  const form = page.getByRole("form", { name: say_("a11y.my_card") });
  for (const trade of [say_("trade.maid")]) await form.getByRole("button", { name: trade, exact: true }).click();
  for (const key of ["day.1", "day.2", "day.3", "day.4", "day.5", "terms.window.morning"] as const)
    await form.getByRole("button", { name: say_(key), exact: true }).click();
  await expect(form.getByRole("button", { name: say_("day.1"), exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(form).toContainText(say_("terms.card_public"));
  await shoot("work-days", { worker: page }, FOLDER);
});
