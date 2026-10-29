import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { chooseLanguage, completeSignIn, newPhone, Role, RUN, tabs } from "./helpers.js";

/** People type their mobile number the way they say it: ten digits, no country code. */
const { hi } = Lang.enum;

test("sign-in takes a 10-digit number as typed, and says so plainly when a number is too short", async ({ page }) => {
  await chooseLanguage(page, hi);
  const form = page.getByRole("form", { name: t(hi, "signin.label") });
  // The other fields are filled, so only the number can be wrong.
  await form.getByLabel(t(hi, "signin.name")).fill(`Phone ${RUN}`);
  await form.getByLabel(t(hi, "signin.address")).fill("Indiranagar");
  await form.getByLabel(t(hi, "signin.phone")).fill("12345");
  await page.getByRole("button", { name: t(hi, "signin.send_code"), exact: true }).click();
  await expect(page.getByText(t(hi, "signin.err_phone"))).toBeVisible();

  // "98xxxxxxxx" with a space, as people write it: the app adds +91 itself.
  const tenDigits = newPhone().slice(3);
  const typed = `${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
  await completeSignIn(page, {
    role: Role.consumer,
    name: `Phone ${RUN}`,
    phone: typed,
    address: "Indiranagar",
    lang: hi,
  });
  await expect(tabs(page, hi)).toBeVisible();
});
