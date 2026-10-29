import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import {
  completeSignIn,
  FakeSpeechMode,
  fakeSpeech,
  newPhone,
  noSpeech,
  open,
  openCard,
  Role,
  RUN,
  setUpi,
  signIn,
  tabs,
  textOf,
} from "./helpers.js";
import { cleanUpLater, unlistCards } from "./journey.js";

/**
 * The card interview on Talk. A worker with no card lands there, and the app asks one thing at a time in their
 * language; they answer by voice, by typing or by tapping a choice, and nothing is published without their yes. The
 * voice is the dev build's fake engine (adapters/speech-fake.ts): each tap on the mic hears the next answer on a list,
 * so these prove the path from the mic to the board, not a recognizer's accuracy.
 */

const { en, hi, kn } = Lang.enum;

/** A Hindi cook's answers, as she would say them, and what the app asks after each. */
const HINDI: readonly (readonly [said: string, next: MessageKey])[] = [
  ["मैं खाना बनाती हूँ", "iv.ask.area"],
  ["कोरमंगला", "iv.ask.rate_month"],
  ["नौ हज़ार", "iv.ask.min"],
  ["साढ़े सात हज़ार", "iv.ask.languages"],
  ["कोई नहीं", "iv.ask.about"],
  ["छोड़ो", "iv.ask.ask_first"],
  // "ना" here only stresses the yes: she wants to be asked first when there are pets.
  ["हाँ ना", "iv.ask.auto"],
  ["नहीं", "iv.confirm"],
  ["हाँ", "iv.published"],
];
const HINDI_SAID = HINDI.map(([said]) => said);

// A card the interview put on the board comes off even when a test stops half-way, so later runs start clean.
test.afterEach(unlistCards);

const mic = (page: Page, lang: Lang) => page.getByRole("button", { name: t(lang, "speech.listen") });
const google = (lang: Lang) => t(lang, "speech.vendor_google");
/** The consent sheet's question and its two answers, for a phone whose only recognizer is Google's. */
const consent = (page: Page, lang: Lang) => ({
  ask: page.getByText(textOf(lang, "speech.cloud_ask", { lang: t(lang, `lang.${lang}`), vendor: google(lang) })),
  allow: page.getByRole("button", { name: t(lang, "speech.cloud_yes"), exact: true }),
  typeInstead: page.getByRole("button", { name: t(lang, "speech.cloud_no"), exact: true }),
});
const field = (page: Page, lang: Lang) =>
  page.getByRole("form", { name: t(lang, "nav.talk") }).getByPlaceholder(t(lang, "agent.placeholder"));

/** Does `act`, then waits for one more line reading `key`: earlier turns stay on screen, so a count says it is new. */
async function nextTurn(page: Page, lang: Lang, key: MessageKey, act: () => Promise<void>) {
  const lines = page.getByText(textOf(lang, key));
  const before = await lines.count();
  await act();
  await expect(lines).toHaveCount(before + 1);
}

/** Types an answer into Talk's composer and sends it. */
async function type(page: Page, lang: Lang, text: string) {
  await field(page, lang).fill(text);
  await page.getByRole("button", { name: t(lang, "a11y.send"), exact: true }).click();
}

/** Takes the card off the board, so later runs start clean, and waits until Profile says so. */
async function unlist(page: Page, lang: Lang) {
  await openCard(page, lang);
  await page.getByRole("button", { name: t(lang, "card.unlist") }).click();
  await open(page, "nav.profile", lang);
  await expect(page.getByText(t(lang, "profile.card_off"))).toBeVisible();
}

test("a Hindi cook makes her card by voice, leaves halfway and comes back, then changes her rate by saying so", async ({
  page,
}) => {
  await fakeSpeech(page, HINDI_SAID);
  await signIn(page, { role: Role.worker, name: `Asha ${RUN}`, phone: newPhone(), lang: hi });
  cleanUpLater({ page, lang: hi });
  await expect(tabs(page, hi).getByRole("button", { name: t(hi, "nav.talk") })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(textOf(hi, "iv.ask.trade"))).toBeVisible();

  const [head, tail] = [HINDI.slice(0, 2), HINDI.slice(2)];
  for (const [, next] of head) await nextTurn(page, hi, next, () => mic(page, hi).click());

  await test.step("switching tabs keeps her place", async () => {
    await open(page, "nav.profile", hi);
    await open(page, "nav.talk", hi);
    await expect(page.getByText(textOf(hi, "iv.ask.rate_month"))).toHaveCount(1);
    await expect(page.getByText(textOf(hi, "iv.ask.trade"))).toHaveCount(1);
  });

  for (const [, next] of tail) {
    // Before her last yes, the summary reads back both amounts; the lowest is shown, never spoken.
    if (next === "iv.published") {
      await expect(page.getByText(textOf(hi, "iv.summary", { rate: "₹9,000" }))).toBeVisible();
      await expect(page.getByText(textOf(hi, "iv.summary_min", { min: "₹7,500" }))).toBeVisible();
    }
    await nextTurn(page, hi, next, () => mic(page, hi).click());
  }

  await open(page, "nav.profile", hi);
  await expect(page.getByText(textOf(hi, "card.on_board", { price: "₹9,000" }))).toBeVisible();

  await test.step("saying 'change my rate' on Talk asks the rate again", async () => {
    await open(page, "nav.talk", hi);
    const said = "मेरा रेट बदलो";
    await type(page, hi, said);
    // A new interview replaces the finished one on screen: her words, then the rate question, open to answer.
    await expect(page.getByText(said, { exact: true })).toBeVisible();
    await expect(page.getByText(textOf(hi, "iv.published"))).toHaveCount(0);
    await expect(page.getByText(textOf(hi, "iv.ask.rate_month"))).toHaveCount(1);
    await expect(page.getByRole("button", { name: t(hi, "iv.later"), exact: true })).toBeVisible();
  });
  await unlist(page, hi);
});

test("a Kannada electrician types and taps, says no at the summary, and changes the rate", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Ravi ${RUN}`, phone: newPhone(), lang: kn });
  cleanUpLater({ page, lang: kn });
  await expect(page.getByText(textOf(kn, "iv.ask.trade"))).toBeVisible();
  await nextTurn(page, kn, "iv.ask.area", () => type(page, kn, "ನಾನು ಎಲೆಕ್ಟ್ರಿಷಿಯನ್"));
  const hsr = page.getByRole("button", { name: t(kn, "area.hsr_layout"), exact: true });
  await nextTurn(page, kn, "iv.ask.rate_visit", () => hsr.last().click());
  await nextTurn(page, kn, "iv.ask.min", () => type(page, kn, "೫೦೦"));
  await nextTurn(page, kn, "iv.ask.languages", () => type(page, kn, "400"));
  await nextTurn(page, kn, "iv.ask.about", () => type(page, kn, "ಯಾವುದೂ ಇಲ್ಲ"));
  await nextTurn(page, kn, "iv.ask.auto", () => type(page, kn, "ಫ್ಯಾನ್, ಸ್ವಿಚ್ ಮತ್ತು ವೈರಿಂಗ್ ಕೆಲಸ"));
  await nextTurn(page, kn, "iv.confirm", () => type(page, kn, "ಇಲ್ಲ"));
  await expect(page.getByText(textOf(kn, "iv.summary", { rate: "₹500" }))).toBeVisible();

  // No at the summary: the app asks what to change, and the word for rate asks that one again.
  await nextTurn(page, kn, "iv.what_change", () => type(page, kn, "ಇಲ್ಲ"));
  await nextTurn(page, kn, "iv.ask.rate_visit", () => type(page, kn, "ದರ"));
  await nextTurn(page, kn, "iv.confirm", () => type(page, kn, "600"));
  await expect(page.getByText(textOf(kn, "iv.summary", { rate: "₹600" }))).toBeVisible();
  await nextTurn(page, kn, "iv.published", () => type(page, kn, "ಹೌದು"));
  await unlist(page, kn);
});

test("a worker who switches to Hindi part-way gets the rest of the interview, and what was said, in Hindi", async ({
  page,
}) => {
  await signIn(page, { role: Role.worker, name: `Divya ${RUN}`, phone: newPhone() });
  for (const [answer, next] of [
    ["cook", "iv.ask.area"],
    ["Koramangala", "iv.ask.rate_month"],
    ["9000", "iv.ask.min"],
    ["7000", "iv.ask.languages"],
  ] as const) {
    await nextTurn(page, en, next, () => type(page, en, answer));
  }
  await open(page, "nav.profile", en);
  const language = page.getByRole("region", { name: t(en, "profile.language") });
  await language.getByRole("button", { name: t(en, "lang.hi") }).click();
  await open(page, "nav.talk", hi);
  // Hindi is now the language she speaks first, and the readbacks so far are in Hindi too.
  await expect(page.getByText(textOf(hi, "iv.ask.languages", { lang: t(hi, "lang.hi") }))).toBeVisible();
  await expect(page.getByText(textOf(hi, "iv.got_rate", { price: "₹9,000" }))).toBeVisible();
  await expect(page.getByText(textOf(en, "iv.ask.languages"))).toHaveCount(0);
});

test("with no speech recognition at all, the mic says to type and puts the cursor in the field", async ({ page }) => {
  await noSpeech(page);
  await signIn(page, { role: Role.worker, name: `Nandini ${RUN}`, phone: newPhone() });
  await mic(page, en).click();
  await expect(page.getByText(t(en, "speech.unavailable", { lang: t(en, "lang.en") }))).toBeVisible();
  await expect(field(page, en)).toBeFocused();
});

test("with only a cloud recognizer, the mic asks before her voice leaves the phone, and Profile takes it back", async ({
  page,
}) => {
  await fakeSpeech(page, ["मैं खाना बनाती हूँ", "कोरमंगला", "नौ हज़ार"], FakeSpeechMode.cloud);
  await signIn(page, { role: Role.worker, name: `Sunita ${RUN}`, phone: newPhone(), lang: hi });
  const { ask, allow, typeInstead } = consent(page, hi);

  // The sheet takes focus, so a screen reader lands on it; "I'll type" sends nothing and puts the cursor in the field.
  await mic(page, hi).click();
  await expect(ask).toBeVisible();
  await expect(allow).toBeFocused();
  await typeInstead.click();
  await expect(ask).toBeHidden();
  await expect(field(page, hi)).toBeFocused();
  await expect(page.getByText(textOf(hi, "iv.ask.area"))).toHaveCount(0);

  // Asked again, she allows it once: that answer is heard, and so is the next, with no second question.
  await mic(page, hi).click();
  await expect(ask).toBeVisible();
  await nextTurn(page, hi, "iv.ask.area", () => allow.click());
  await nextTurn(page, hi, "iv.ask.rate_month", () => mic(page, hi).click());

  // Profile says where her voice goes, and stops it; the mic then asks again.
  await open(page, "nav.profile", hi);
  const sending = page.getByText(textOf(hi, "speech.cloud_on", { vendor: google(hi) }));
  await expect(sending).toBeVisible();
  await expect(page.getByText(textOf(hi, "speech.where_cloud", { vendor: google(hi) }))).toBeVisible();
  await page.getByRole("button", { name: t(hi, "speech.cloud_withdraw") }).click();
  await expect(sending).toBeHidden();
  await open(page, "nav.talk", hi);
  await mic(page, hi).click();
  await expect(ask).toBeVisible();
  await typeInstead.click();
  await expect(field(page, hi)).toBeFocused();

  // Allowed again, her rate is heard. Her lowest rate never is, even so: the mic asks her to type that one.
  await mic(page, hi).click();
  await nextTurn(page, hi, "iv.ask.min", () => allow.click());
  await mic(page, hi).click();
  await expect(page.getByText(textOf(hi, "speech.type_private", { vendor: google(hi) }))).toBeVisible();
  await expect(ask).toBeHidden();
  await expect(field(page, hi)).toBeFocused();
  await nextTurn(page, hi, "iv.ask.languages", () => type(page, hi, "सात हज़ार"));
});

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
