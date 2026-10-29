import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import {
  completeSignIn,
  FakeSpeechMode,
  fakeSpeech,
  newPhone,
  open,
  Role,
  RUN,
  setUpi,
  signIn,
  textOf,
} from "./helpers.js";
import { unlistCards } from "./journey.js";
import { consent, mic, nextTurn, type } from "./talk.js";

/** A shared phone: what one worker told the card interview, their UPI ID and their voice consent end at sign-out. */

const { hi } = Lang.enum;

test.afterEach(unlistCards);

test("signing out leaves the next worker on the phone nothing of the last: answers, UPI ID or voice consent", async ({
  page,
}) => {
  await fakeSpeech(page, ["मैं खाना बनाती हूँ"], FakeSpeechMode.cloud);
  await signIn(page, { role: Role.worker, name: `Meena ${RUN}`, phone: newPhone(), lang: hi });
  const { ask, allow } = consent(page, hi);
  await mic(page, hi).click();
  await nextTurn(page, hi, "iv.ask.area", () => allow.click());
  await nextTurn(page, hi, "iv.ask.rate_month", () => type(page, hi, "कोरमंगला"));
  await nextTurn(page, hi, "iv.ask.min", () => type(page, hi, "नौ हज़ार"));
  await nextTurn(page, hi, "iv.ask.languages", () => type(page, hi, "सात हज़ार"));
  await setUpi(page, hi, "meena.test@okaxis");
  await page.getByRole("button", { name: t(hi, "shell.sign_out") }).click();

  await completeSignIn(page, { role: Role.worker, name: `Geeta ${RUN}`, phone: newPhone(), lang: hi });
  // Her own interview from the first question: nothing Meena said, and not Meena's lowest rate.
  await expect(page.getByText(textOf(hi, "iv.ask.trade"))).toHaveCount(1);
  await expect(page.getByText("कोरमंगला", { exact: true })).toHaveCount(0);
  await expect(page.getByText(textOf(hi, "iv.got_min"))).toHaveCount(0);
  // Asked before any company hears her, and paid to no one else's UPI ID.
  await mic(page, hi).click();
  await expect(ask).toBeVisible();
  await open(page, "nav.profile", hi);
  const paidTo = page.getByRole("form", { name: t(hi, "settings.paid_to") });
  await expect(paidTo.getByLabel(t(hi, "settings.vpa"), { exact: true })).toHaveValue("");
});
