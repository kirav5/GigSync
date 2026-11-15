import { HttpMethod, type MessageKey, type Params, t } from "@gigsync/core";
import { type BoardProfile, type GeoResult, Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { plainMap } from "./address.js";
import { API, navRow, newPhone, open, openProfile, Role, RUN, shoot, signIn } from "./helpers.js";
import { publishCard, unlistCards } from "./journey.js";

/**
 * A worker's work area on its own page, from the profile (the owner could not find it in My card's long form): the row
 * says the area and the distance, and opens the map with the circle and the slider, and a places search that suggests
 * as they type. Saving puts the card on the board again with the new place.
 */

const en = Lang.enum.en;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const FOLDER = "work-area";
const PHONE = { width: 390, height: 844 };
const BOARD_PROFILE = `${API}/v1/board/profile`;
const VILLAS = "LGCL Bamboo Forest Villas, Rayasandra Main Rd, Choodasandra, Bengaluru, Karnataka, 560100, India";
const FOUND: GeoResult = {
  places: [{ label: VILLAS, locality: "Choodasandra", city: "Bengaluru", point: { lat: 12.8773, lon: 77.6745 } }],
};

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phone(browser: { newContext: (o: object) => Promise<BrowserContext> }): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  contexts.push(context);
  const page = await context.newPage();
  await plainMap(page);
  return page;
}

test("the profile's Work area row opens the map, finds a place as the worker types, and saves it", async ({
  browser,
}) => {
  const page = await phone(browser);
  const searches: URL[] = [];
  await page.route(`${API}/v1/geo/search**`, (route) => {
    searches.push(new URL(route.request().url()));
    return route.fulfill({ json: FOUND });
  });
  await signIn(page, { role: Role.worker, name: `Kavya ${RUN}`, phone: newPhone(), lang: en });
  await publishCard(
    { page, lang: en },
    { trade: "Cook", area: "jayanagar", rate: "11000", min: "9000", about: "Home food" },
  );

  // The row says where and how far, before it is opened.
  await openProfile(page, en);
  await expect(navRow(page, "me.work_area", en)).toContainText(say("me.area_km", { area: "Jayanagar", km: 10 }));
  await open(page, "me.work_area", en);
  await expect(page.locator(".radius-map-frame")).toBeVisible();
  await shoot("area", { worker: page }, FOLDER);

  // Suggestions as she types, with no Enter: one lookup once she pauses, near where she works now.
  const search = page.getByRole("searchbox", { name: say("addr.search") });
  await search.pressSequentially("lgcl bamboo", { delay: 30 });
  const villas = page.getByRole("button", { name: /^LGCL Bamboo Forest Villas/ });
  await expect(villas).toBeVisible();
  expect(searches).toHaveLength(1);
  expect(searches[0]?.searchParams.get("q")).toBe("lgcl bamboo");
  expect(searches[0]?.searchParams.has("lat")).toBe(true);
  await shoot("suggested", { worker: page }, FOLDER);
  await villas.click();
  await expect(
    page.getByRole("status").filter({ hasText: say("card.area_found", { area: "Choodasandra" }) }),
  ).toBeVisible();

  // Further, and saved: the card goes to the board again from Choodasandra, on the coarse grid.
  await page.getByRole("slider", { name: say("card.radius") }).fill("15");
  const sent = page.waitForRequest((r) => r.url() === BOARD_PROFILE && r.method() === HttpMethod.put);
  await page.getByRole("button", { name: say("me.work_area_save"), exact: true }).click();
  const card = (await sent).postDataJSON() as BoardProfile;
  expect(card.area_name).toBe("Choodasandra");
  expect(card.area).toEqual({ lat: 12.88, lon: 77.67 });
  await expect(
    page.getByRole("status").filter({ hasText: say("me.work_area_saved", { area: "Choodasandra", km: 15 }) }),
  ).toBeVisible();
  await shoot("saved", { worker: page }, FOLDER);
  await openProfile(page, en);
  await expect(navRow(page, "me.work_area", en)).toContainText(say("me.area_km", { area: "Choodasandra", km: 15 }));
});
