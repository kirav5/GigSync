import { type MessageKey, priceText, t } from "@gigsync/core";
import { EstimateBasisKind, Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import {
  drawer,
  FakeSpeechMode,
  fakeSpeech,
  newPhone,
  noSpeech,
  onScreen,
  open,
  openDrawer,
  Role,
  RUN,
  signIn,
  textOf,
} from "./helpers.js";
import { cleanUpLater, unlistCards } from "./journey.js";
import { COOK_REQUEST, estimateNow } from "./market-seed.js";
import { consent, field, google, inOrder, mic, nextTurn, type, unlist } from "./talk.js";

/**
 * The card interview on Talk. A worker with no card lands there, and the app asks one thing at a time in their
 * language; they answer by voice, by typing or by tapping a choice, and nothing is published without their yes. The
 * voice is the dev build's fake engine (adapters/speech-fake.ts): each tap on the mic hears the next answer on a list,
 * so these prove the path from the mic to the board, not a recognizer's accuracy.
 */

const { en, hi, kn } = Lang.enum;

/** A Hindi cook's answers, as she would say them, and what the app asks after each. */
const HINDI: readonly (readonly [said: string, next: MessageKey])[] = [
  // A cook says which work she takes (ADR 0051): every month.
  ["मैं खाना बनाती हूँ", "iv.ask.also"],
  // The rest of house help (ADR 0061): she does none of it.
  ["नहीं", "iv.ask.arrangements"],
  ["हर महीने", "iv.ask.area"],
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

/** A note to herself in Hindi that the on-phone router saves ("remember: …"). */
const NOTE = "याद रखना: तीसरी मंज़िल वाले ग्राहक 5 तारीख़ को पैसे देते हैं";

test("a Hindi cook makes her card by voice, leaves halfway and comes back, then changes her rate by saying so", async ({
  page,
}) => {
  await fakeSpeech(page, HINDI_SAID);
  await signIn(page, { role: Role.worker, name: `Asha ${RUN}`, phone: newPhone(), lang: hi });
  cleanUpLater({ page, lang: hi });
  await onScreen(page, "nav.talk", hi);
  await expect(page.getByText(textOf(hi, "iv.ask.trade"))).toBeVisible();

  const [head, tail] = [HINDI.slice(0, 4), HINDI.slice(4)];
  for (const [, next] of head) await nextTurn(page, hi, next, () => mic(page, hi).click());

  await test.step("under the rate question, the estimate for a cook in Bengaluru, what it rests on and the legal minimum", async () => {
    // What the API answers now for a cook (3–4 people, two meals) in Koramangala (ADR 0041): GigSync's rate blended
    // with the city's rate card when the shared database holds enough cooking jobs from the record seeds, else the
    // rate card alone.
    const e = await estimateNow({ ...COOK_REQUEST, area: "koramangala" });
    expect(e).toBeDefined();
    const cook = t(hi, "trade.cook");
    const city = t(hi, "city.bengaluru");
    const scope = t(hi, "estimate.scope", {
      scope: `${t(hi, "estimate.people.3_4")}, ${t(hi, "estimate.meals.2")}`,
    });
    const prices = { low: priceText(e?.low_paise ?? 0), high: priceText(e?.high_paise ?? 0) };
    await expect(
      page.getByText(textOf(hi, "estimate.range_month", { trade: cook, city, scope, ...prices })),
    ).toBeVisible();
    const basis = page.getByText(textOf(hi, "driver.basis_line")).last();
    await expect(basis).toContainText(t(hi, "driver.basis.rate_card", { city, sources: "" }));
    if (e?.basis.kind === EstimateBasisKind.enum.gigsync) {
      await expect(basis).toContainText(t(hi, "driver.basis.gigsync.other", { count: e.basis.gigsync_jobs }));
    }
    await expect(page.getByText(textOf(hi, "estimate.legal_min", { min: "₹6,430" }))).toBeVisible();
    await expect(page.getByText(textOf(hi, "estimate.suggest_rate"))).toBeVisible();
  });

  await test.step("going to another screen keeps her place", async () => {
    await open(page, "nav.about", hi);
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

  await open(page, "nav.card", hi);
  await expect(page.getByRole("region", { name: t(hi, "page.card_seen") })).toContainText("₹9,000");

  await test.step("a note on Talk stays there across screens; no standing buttons under the conversation", async () => {
    await open(page, "nav.talk", hi);
    await type(page, hi, NOTE);
    await expect(page.getByText(t(hi, "card.saved"), { exact: true })).toBeVisible();
    await open(page, "nav.about", hi);
    await open(page, "nav.talk", hi);
    await expect(page.getByText(NOTE, { exact: true })).toBeVisible();
    await expect(page.getByText(t(hi, "card.saved"), { exact: true })).toBeVisible();
    // Suggestions belong to an empty Talk only; changing the card lives in My card and in what she says.
    await expect(page.getByRole("button", { name: t(hi, "agent.suggest_rate"), exact: true })).toHaveCount(0);
  });

  await test.step("saying 'change my rate' on Talk asks the rate again, below everything said before", async () => {
    const said = "मेरा रेट बदलो";
    await type(page, hi, said);
    // The new interview is added after the finished one and the note: her words, then the rate question, open.
    await expect(page.getByText(said, { exact: true })).toBeVisible();
    await expect(page.getByText(textOf(hi, "iv.published"))).toHaveCount(1);
    await expect(page.getByText(textOf(hi, "iv.ask.rate_month"))).toHaveCount(2);
    await expect(page.getByRole("button", { name: t(hi, "iv.later"), exact: true })).toBeVisible();
    await inOrder(page, [
      textOf(hi, "iv.ask.trade"),
      textOf(hi, "iv.published"),
      NOTE,
      t(hi, "card.saved"),
      said,
      textOf(hi, "iv.ask.rate_month"),
    ]);
  });
  await test.step("New chat keeps this chat in the menu with its open question, and earnings come from Records", async () => {
    await openDrawer(page, hi);
    await drawer(page, hi)
      .getByRole("button", { name: t(hi, "chats.new"), exact: true })
      .click();
    await expect(page.getByText(t(hi, "agent.empty"))).toBeVisible();
    await expect(page.getByText(NOTE, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: t(hi, "agent.suggest_earned"), exact: true }).click();
    await expect(page.getByText(t(hi, "agent.earnings", { week: "₹0", month: "₹0", waiting: "₹0" }))).toBeVisible();
    await expect(page.getByText(t(hi, "agent.empty"))).toHaveCount(0);
    // The chat she left is listed by her first words, with the rate change she has not finished.
    await openDrawer(page, hi);
    const left = drawer(page, hi)
      .getByRole("region", { name: t(hi, "chats.title") })
      .getByRole("listitem")
      .filter({ hasText: HINDI_SAID[0] ?? "" });
    await expect(left).toContainText(t(hi, "chats.card_waiting"));
  });
  await unlist(page, hi);
});

test("a Kannada electrician types and taps, says no at the summary, and changes the rate", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Ravi ${RUN}`, phone: newPhone(), lang: kn });
  cleanUpLater({ page, lang: kn });
  await expect(page.getByText(textOf(kn, "iv.ask.trade"))).toBeVisible();
  await nextTurn(page, kn, "iv.ask.also", () => type(page, kn, "ನಾನು ಎಲೆಕ್ಟ್ರಿಷಿಯನ್"));
  await nextTurn(page, kn, "iv.ask.area", () => type(page, kn, "ಇಲ್ಲ"));
  const hsr = page.getByRole("button", { name: t(kn, "area.hsr_layout"), exact: true });
  await nextTurn(page, kn, "iv.ask.rate_visit", () => hsr.last().click());
  // No band for electricians yet: the app says so rather than guess, and shows no monthly number under a visit's rate.
  const electrician = t(kn, "trade.electrician");
  await expect(page.getByText(textOf(kn, "iv.band_none", { trade: electrician }))).toBeVisible();
  await expect(page.getByText(textOf(kn, "iv.band_month"))).toHaveCount(0);
  await expect(page.getByText(textOf(kn, "iv.legal_min"))).toHaveCount(0);
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
    ["cook", "iv.ask.also"],
    ["no", "iv.ask.arrangements"],
    ["monthly", "iv.ask.area"],
    ["Koramangala", "iv.ask.rate_month"],
    ["9000", "iv.ask.min"],
    ["7000", "iv.ask.languages"],
  ] as const) {
    await nextTurn(page, en, next, () => type(page, en, answer));
  }
  await open(page, "nav.about", en);
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

test("with only a cloud recognizer, the mic asks before her voice leaves the phone, and Settings takes it back", async ({
  page,
}) => {
  await fakeSpeech(page, ["मैं खाना बनाती हूँ", "हर महीने", "नौ हज़ार"], FakeSpeechMode.cloud);
  await signIn(page, { role: Role.worker, name: `Sunita ${RUN}`, phone: newPhone(), lang: hi });
  const { ask, allow, typeInstead } = consent(page, hi);

  // The sheet takes focus, so a screen reader lands on it; "I'll type" sends nothing and puts the cursor in the field.
  await mic(page, hi).click();
  await expect(ask).toBeVisible();
  await expect(allow).toBeFocused();
  await typeInstead.click();
  await expect(ask).toBeHidden();
  await expect(field(page, hi)).toBeFocused();
  await expect(page.getByText(textOf(hi, "iv.ask.also"))).toHaveCount(0);

  // Asked again, she allows it once: that answer is heard, and so is the next, with no second question.
  await mic(page, hi).click();
  await expect(ask).toBeVisible();
  // A cook is asked which work she takes (ADR 0051), then her area.
  await nextTurn(page, hi, "iv.ask.also", () => allow.click());
  await nextTurn(page, hi, "iv.ask.arrangements", () => type(page, hi, "नहीं"));
  await nextTurn(page, hi, "iv.ask.area", () => mic(page, hi).click());
  await nextTurn(page, hi, "iv.ask.rate_month", () => type(page, hi, "कोरमंगला"));

  // Settings say where her voice goes, and stop it; the mic then asks again.
  await open(page, "nav.settings", hi);
  const sending = page.getByText(textOf(hi, "speech.cloud_on", { vendor: google(hi) }));
  await expect(sending).toBeVisible();
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
