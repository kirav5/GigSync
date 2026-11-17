import { type MessageKey, t } from "@gigsync/core";
import { type GeoResult, Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { addressSave, doorField, moreDetails, plainMap } from "./address.js";
import { API, newPhone, open, Role, RUN, shoot, signIn } from "./helpers.js";

/**
 * The door pin on Saved places, laid out as a map app's "add address" (ADR 0050 §7): the map first, with "Use my
 * current location" floating on it; one search field that suggests as the owner types (or on Enter), its places as
 * rows; the flat; "Save as" as chips with their marks and no radio dots, the picked one tinted; and "This is my door"
 * in the screen's dock, which still saves the form.
 */

const { en } = Lang.enum;
const FOLDER = "address-pin";
const AREA = "Indiranagar";
const PHONE = { width: 390, height: 844 };
/** The app's pause before it looks up what was typed (usePlaceSearch.ts). */
const TYPE_PAUSE_MS = 350;
const say = (key: MessageKey, params?: Record<string, string>) => t(en, key, params);
const FOUND: GeoResult = {
  places: [
    {
      label: "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038, India",
      locality: AREA,
      city: "Bengaluru",
      pin: "560038",
      street: "100 Feet Road",
      point: { lat: 12.97, lon: 77.64 },
    },
  ],
};

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phone(browser: { newContext: (o: object) => Promise<BrowserContext> }): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  contexts.push(context);
  const page = await context.newPage();
  await plainMap(page);
  await page.route(`${API}/v1/geo/search**`, (route) => route.fulfill({ json: FOUND }));
  await page.route(`${API}/v1/geo/reverse**`, (route) => route.fulfill({ json: FOUND }));
  return page;
}

test("Saved places adds an address on the map, saved from the dock", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.consumer, name: `Asha ${RUN}`, phone: newPhone(), lang: en });
  await open(page, "me.addresses", en);
  await page.getByRole("button", { name: say("addr.add"), exact: true }).click();
  const form = page.getByRole("form", { name: say("addr.add") });

  // The map first, and the location chip floating on its foot, inside the map's box.
  const map = form.locator(".place-map");
  await expect(map).toBeVisible();
  const locate = form.getByRole("button", { name: say("addr.use_location"), exact: true });
  const [mapBox, chipBox] = await Promise.all([map.boundingBox(), locate.boundingBox()]);
  expect(chipBox && mapBox && chipBox.y > mapBox.y && chipBox.y + chipBox.height <= mapBox.y + mapBox.height).toBe(
    true,
  );

  // One search field: Enter searches, and the found place is a row to tap.
  const search = form.getByRole("searchbox", { name: say("addr.search") });
  await expect(form.getByRole("button", { name: say("addr.find"), exact: true })).toBeVisible();
  await search.fill(AREA);
  await search.press("Enter");
  await form.getByRole("button", { name: /^100 Feet Road/ }).click();
  await expect(form.getByRole("status").filter({ hasText: AREA })).toBeVisible();

  // Save as: chips, the radio inside each hidden, the picked one tinted.
  const saveAs = form.getByRole("group", { name: say("addr.label") });
  await expect(saveAs.getByRole("radio")).toHaveCount(4);
  await saveAs.getByText(say("addr.label.work"), { exact: true }).click();
  await expect(saveAs.getByRole("radio", { name: say("addr.label.work") })).toBeChecked();
  await expect(saveAs.locator(".label-chip.on")).toHaveText(say("addr.label.work"));
  await expect(saveAs.getByRole("radio", { name: say("addr.label.work") })).toHaveCSS("opacity", "0");

  await doorField(form, en).fill("Flat 3C");
  await moreDetails(form, en);
  await shoot("door-pin", { household: page }, FOLDER);
  // The save button stands in the dock, outside the form, and still saves it.
  const save = page.locator(".dock").getByRole("button", { name: say("addr.door_save"), exact: true });
  await expect(save).toBeVisible();
  await expect(addressSave(form, en)).toBeVisible();
  await save.click();
  const book = page.getByRole("region", { name: say("addr.title") });
  await expect(book).toContainText("Flat 3C");
  await expect(book).toContainText(say("addr.label.work"));
});

test("the search suggests places as the owner types, with no Enter, asking once they pause", async ({ browser }) => {
  const page = await phone(browser);
  const asked: URL[] = [];
  await page.route(`${API}/v1/geo/search**`, (route) => {
    asked.push(new URL(route.request().url()));
    return route.fulfill({ json: FOUND });
  });
  await signIn(page, { role: Role.consumer, name: `Meera ${RUN}`, phone: newPhone(), lang: en });
  await open(page, "me.addresses", en);
  await page.getByRole("button", { name: say("addr.add"), exact: true }).click();
  const form = page.getByRole("form", { name: say("addr.add") });
  const search = form.getByRole("searchbox", { name: say("addr.search") });
  const found = form.getByRole("button", { name: /^100 Feet Road/ });
  // Two letters ask nothing; the rest, typed quickly, ask once, near the city's centre.
  await search.pressSequentially("In", { delay: 30 });
  await page.waitForTimeout(TYPE_PAUSE_MS * 2);
  expect(asked).toHaveLength(0);
  await search.pressSequentially("diranagar", { delay: 30 });
  await expect(found).toBeVisible();
  expect(asked.map((u) => u.searchParams.get("q"))).toEqual([AREA]);
  expect(asked[0]?.searchParams.has("lat") && asked[0]?.searchParams.has("lon")).toBe(true);
  await shoot("type-ahead", { household: page }, FOLDER);
  await found.click();
  await expect(form.getByRole("status").filter({ hasText: AREA })).toBeVisible();
  await expect(found).toHaveCount(0);
});
