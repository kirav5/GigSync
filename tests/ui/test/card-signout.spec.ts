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
  signOutHere,
  textOf,
} from "./helpers.js";
import { unlistCards } from "./journey.js";
import { consent, mic, nextTurn, type } from "./talk.js";

/**
 * A shared phone: what one worker told the card interview and their voice consent end at sign-out; their UPI ID stays
 * theirs, unseen by the next worker on the phone and back when they sign in again.
 */

const { hi } = Lang.enum;

test.afterEach(unlistCards);

test("the next worker on the phone gets nothing of the last: answers, UPI ID or voice consent", async ({ page }) => {
  await fakeSpeech(page, ["मैं खाना बनाती हूँ"], FakeSpeechMode.cloud);
  const meena = { role: Role.worker, name: `Meena ${RUN}`, phone: newPhone(), lang: hi };
  await signIn(page, meena);
  const { ask, allow } = consent(page, hi);
  await mic(page, hi).click();
  // A cook says which work she takes (ADR 0051) before her area.
  await nextTurn(page, hi, "iv.ask.arrangements", () => allow.click());
  await nextTurn(page, hi, "iv.ask.area", () => type(page, hi, "हर महीने"));
  await nextTurn(page, hi, "iv.ask.rate_month", () => type(page, hi, "कोरमंगला"));
  await nextTurn(page, hi, "iv.ask.min", () => type(page, hi, "नौ हज़ार"));
  await nextTurn(page, hi, "iv.ask.languages", () => type(page, hi, "सात हज़ार"));
  await setUpi(page, hi, "meena.test@okaxis");
  await signOutHere(page, hi);

  await completeSignIn(page, { role: Role.worker, name: `Geeta ${RUN}`, phone: newPhone(), lang: hi });
  // Her own interview from the first question: nothing Meena said, and not Meena's lowest rate.
  await expect(page.getByText(textOf(hi, "iv.ask.trade"))).toHaveCount(1);
  await expect(page.getByText("कोरमंगला", { exact: true })).toHaveCount(0);
  await expect(page.getByText(textOf(hi, "iv.got_min"))).toHaveCount(0);
  // Asked before any company hears her, and paid to no one else's UPI ID.
  await mic(page, hi).click();
  await expect(ask).toBeVisible();
  await open(page, "nav.about", hi);
  const paidTo = page.getByRole("form", { name: t(hi, "settings.paid_to") });
  await expect(paidTo.getByLabel(t(hi, "settings.vpa"), { exact: true })).toHaveValue("");

  // Meena signs back in: her UPI ID was kept for her.
  await signOutHere(page, hi);
  await completeSignIn(page, meena);
  await open(page, "nav.about", hi);
  // Saved, it is one line with Change rather than the form.
  const savedUpi = page.getByRole("region", { name: t(hi, "settings.paid_to") });
  await expect(savedUpi).toContainText("meena.test@okaxis");
  await expect(savedUpi.getByRole("button", { name: t(hi, "settings.change"), exact: true })).toBeVisible();
});
