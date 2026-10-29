import { writeFileSync } from "node:fs";
import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { newPhone, open, Role, RUN, SHOTS, signIn } from "./helpers.js";

/**
 * The desktop colleague's half of the iPhone worker-to-worker check. Playwright cannot reach the web view inside an
 * iOS app, so the iPhone worker runs by hand (or by an agent) on the simulator. This signs in a worker, shows a
 * colleague code and writes its text to screenshots/ios/colleague-code.txt (the simulator has no camera, so the iPhone
 * pastes it into the dev-only field), waits until the iPhone worker named IOS_PARTNER links, sends a note and waits
 * for the reply:
 *   IOS_PARTNER="Asha 123" pnpm exec playwright test ios-colleague-partner --project=chromium
 */

const PARTNER = process.env.IOS_PARTNER;
const { en } = Lang.enum;
const DIR = `${SHOTS}ios/`;
const NOTE = "Is there work tomorrow morning?";
/** The iPhone side taps through by hand, so each wait allows for a person's pace. */
const HUMAN_MS = 900_000;

test.skip(!PARTNER, "drives only the desktop colleague; the iPhone worker runs on the simulator (IOS_PARTNER=<name>)");

test("desktop colleague links with the iPhone worker and they exchange notes", async ({ page }) => {
  test.setTimeout(HUMAN_MS * 3);
  if (!PARTNER) return;
  const shot = (name: string) => page.screenshot({ path: `${DIR}colleague-${name}.png`, fullPage: true });
  const name = `Bhavya ${RUN}`;
  await signIn(page, { role: Role.worker, name, phone: newPhone(), lang: en });
  await open(page, "nav.profile", en);
  const section = page.getByRole("region", { name: t(en, "colleague.title") });
  await section.getByRole("button", { name: t(en, "colleague.show_code") }).click();
  const qr = page.locator("[data-invite]");
  await expect(qr).toBeVisible();
  writeFileSync(`${DIR}colleague-code.txt`, (await qr.getAttribute("data-invite")) ?? "");
  await shot("01-code");

  await expect(page.getByRole("status").filter({ hasText: t(en, "colleague.linked", { name: PARTNER }) })).toBeVisible({
    timeout: HUMAN_MS,
  });
  await shot("02-linked");
  await page.getByRole("button", { name: new RegExp(PARTNER) }).click();
  const box = page.getByRole("form", { name: PARTNER });
  await box.getByRole("textbox").fill(NOTE);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
  await expect(page.locator(".colleague-thread .msg-agent")).toHaveCount(1, { timeout: HUMAN_MS });
  await shot("03-reply");
});
