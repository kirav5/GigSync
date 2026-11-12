import { t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { expect, type Locator, type Page } from "@playwright/test";
import { API } from "../stack.js";
import { open } from "./menu.js";

/**
 * Saved addresses (ADR 0045), as a household adds one from Me › Addresses: the specs that used to type an address at sign-in
 * save it here instead, in the pilot area their Find chat asks in, so the worker gets it once both sign.
 */

/** The pilot areas by their English names, to find one in an address written the old way. */
const PILOT = ["Indiranagar", "Koramangala", "HSR Layout", "Jayanagar", "Whitefield"] as const;
/** A PIN code for the form; the area, not the PIN, places the address. */
const TEST_PIN = "560041";
const DEFAULT_AREA = "HSR Layout";

/** The pilot area an address names ("Flat 7B, 27th Main, HSR Layout"), else HSR Layout. */
export const areaIn = (address: string): string => PILOT.find((a) => address.includes(a)) ?? DEFAULT_AREA;

export interface NewAddress {
  /** What a worker reads first: the whole line the spec checks for after signing. */
  house: string;
  /** The pilot area, by its English name. */
  area: string;
}

/** A map with nothing but its background: enough to show the pin over it. */
export const PLAIN_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: "land", type: "background", paint: { "background-color": "#e9eef2" } }],
};

/** Ola's map needs the API's key, which test runs do not have: a plain style stands in, so maps are drawn. */
export const plainMap = (page: Page) =>
  page.route(`${API}/v1/geo/map/style.json`, (route) => route.fulfill({ json: PLAIN_STYLE }));

/**
 * Fills the address form (Me › Addresses, or Find's "Add an address") with a house in the pilot area, and saves it.
 * Where a map is drawn, the form is the door pin: the flat in its one field, the area and PIN behind "More details",
 * and since the map never moved, the typed area's pin is shown for the owner to check first (ADR 0050 §7): a second
 * "This is my door" keeps it. Without a map it is the typed form, saved once.
 */
/** The address form's flat or house field: the door pin's one field where a map is drawn, else the typed form's. */
export const doorField = (form: Locator, lang: Lang) =>
  form
    .getByLabel(t(lang, "addr.door_field"), { exact: true })
    .or(form.getByLabel(t(lang, "addr.house"), { exact: true }));

/** The address form's save button: "This is my door" on the door pin, else Save. */
export const addressSave = (form: Locator, lang: Lang) =>
  form
    .getByRole("button", { name: t(lang, "addr.door_save"), exact: true })
    .or(form.getByRole("button", { name: t(lang, "addr.save"), exact: true }));

/** Opens the door pin's "More details" (area, PIN, building), where the form has it; the typed form shows them already. */
export async function moreDetails(form: Locator, lang: Lang) {
  const more = form.getByRole("button", { name: t(lang, "addr.more"), exact: true });
  if ((await more.count()) > 0 && (await more.getAttribute("aria-expanded")) !== "true") await more.click();
}

export async function fillAddressForm(page: Page, lang: Lang, a: NewAddress) {
  const form = page.getByRole("form", { name: t(lang, "addr.add") });
  const door = form.getByLabel(t(lang, "addr.door_field"), { exact: true });
  const house = form.getByLabel(t(lang, "addr.house"), { exact: true });
  await expect(door.or(house)).toBeVisible();
  const pinned = await door.isVisible();
  if (pinned) {
    await door.fill(a.house);
    const more = form.getByRole("button", { name: t(lang, "addr.more"), exact: true });
    if ((await more.getAttribute("aria-expanded")) !== "true") await more.click();
  } else await house.fill(a.house);
  await form.getByLabel(t(lang, "addr.area"), { exact: true }).fill(a.area);
  await form.getByLabel(t(lang, "addr.pin"), { exact: true }).fill(TEST_PIN);
  const save = form.getByRole("button", { name: t(lang, pinned ? "addr.door_save" : "addr.save"), exact: true });
  await save.click();
  const check = form.getByRole("status").filter({ hasText: t(lang, "addr.check_pin") });
  await expect.poll(async () => (await check.isVisible()) || !(await form.isVisible())).toBe(true);
  if (await check.isVisible()) await save.click();
}

/** Saves an address from Me › Addresses and comes back to the chat. */
export async function saveAddress(page: Page, lang: Lang, a: NewAddress) {
  await open(page, "me.addresses", lang);
  await page.getByRole("button", { name: t(lang, "addr.add"), exact: true }).click();
  await fillAddressForm(page, lang, a);
  await expect(page.getByRole("region", { name: t(lang, "addr.title") })).toContainText(a.house);
  await open(page, "nav.find", lang);
}
