import { t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { expect, type Page } from "@playwright/test";
import { open } from "./menu.js";

/**
 * Saved addresses (ADR 0045), as a household adds one from Settings: the specs that used to type an address at sign-in
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

/** Fills the address form (Settings, or Find's "Add an address") with a house in the pilot area, and saves it. */
export async function fillAddressForm(page: Page, lang: Lang, a: NewAddress) {
  const form = page.getByRole("form", { name: t(lang, "addr.add") });
  await form.getByLabel(t(lang, "addr.house"), { exact: true }).fill(a.house);
  await form.getByLabel(t(lang, "addr.area"), { exact: true }).fill(a.area);
  await form.getByLabel(t(lang, "addr.pin"), { exact: true }).fill(TEST_PIN);
  await form.getByRole("button", { name: t(lang, "addr.save"), exact: true }).click();
}

/** Saves an address from Settings › Saved addresses and comes back to the chat. */
export async function saveAddress(page: Page, lang: Lang, a: NewAddress) {
  await open(page, "nav.settings", lang);
  await page.getByRole("button", { name: t(lang, "addr.add"), exact: true }).click();
  await fillAddressForm(page, lang, a);
  await expect(page.getByRole("region", { name: t(lang, "addr.title") })).toContainText(a.house);
  await open(page, "nav.find", lang);
}
