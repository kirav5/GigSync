import { type ApiClient, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type Browser, type BrowserContext, expect, test } from "@playwright/test";
import { listWorker, newPhone, open, openCard, Role, RUN, reveal, shoot, signIn, textOf } from "./helpers.js";
import { dealPaise, fillAsk, type Phone, publishCard, sendNote, signBoth, unlistCards } from "./journey.js";
import { pairKey, type TranslationTable, useTableTranslator } from "./translator.js";

/**
 * Agent-flows §1 through the app's real screens, each phone entirely in its owner's language: a Hindi-speaking worker
 * with a Kannada-speaking household, then with an English-speaking one. Keys, numbers and signed terms cross between
 * phones; the free text people type is translated on the reader's phone (here by a table standing in for Chrome's
 * built-in translator) and shown alone, in the reader's language, with no note; the original is shown only beside the
 * reason, when a translation that changed a number is withheld.
 */

/**
 * Where the Hindi–Kannada journey happens. A workaround, not the story's place: Koramangala's cook listings on the
 * shared board are crowded with cards left by aborted runs, and the board lists the nearest ten, oldest account first
 * on a tie, so a new worker there never shows. Jayanagar has none; `unlistCards` keeps it that way.
 */
const JAYANAGAR = { lat: 12.9308, lon: 77.5838 };
const { hi, kn, en } = Lang.enum;

const KN_NEED = "ಬೆಳಗ್ಗೆ ಅಡುಗೆ ಮಾಡುವವರು ಬೇಕು";
const KN_TIME = "ಬೆಳಗ್ಗೆ 7–10";
const KN_MEALS = "ಬೆಳಗ್ಗೆ ಮತ್ತು ರಾತ್ರಿ";
const HI_ABOUT_COOK = "उत्तर और दक्षिण भारतीय खाना";
const HI_NOTE_GATE = "गेट पर 10 मिनट में पहुँचूँगी";
const HI_NOTE_GAS = "गैस के लिए ₹200 अलग से";
const EN_NEED = "Daily sweeping, mopping and dishes";
const EN_TIME = "8am";
const EN_ROOMS = "3 rooms, sweeping and mopping";
const HI_ABOUT_MAID = "झाड़ू, पोछा, बर्तन";
const HI_NOTE_LATE = "कल 15 मिनट देर से आऊँगी";
/** How the app marks other people's words (ui/Said.tsx). `[lang=hi]` would also match the page and the job card. */
const TRANSLATED = '[data-said="translated"]';
const ORIGINAL = '[data-said="original"]';
const KANNADA = /[ಀ-೿]/;
const DEVANAGARI = /[ऀ-ॿ]/;
/** The note every translated line used to carry ("machine translated from Kannada"), gone for good. */
const OLD_NOTE = "मशीन अनुवाद";

const TABLE: TranslationTable = {
  [pairKey(hi, kn, HI_ABOUT_COOK)]: "ಉತ್ತರ ಮತ್ತು ದಕ್ಷಿಣ ಭಾರತೀಯ ಅಡುಗೆ",
  [pairKey(kn, hi, KN_NEED)]: "सुबह खाना बनाने वाले चाहिए",
  [pairKey(kn, hi, KN_TIME)]: "सुबह 7–10",
  [pairKey(kn, hi, KN_MEALS)]: "सुबह और रात",
  [pairKey(hi, kn, HI_NOTE_GATE)]: "10 ನಿಮಿಷದಲ್ಲಿ ಗೇಟ್ ತಲುಪುತ್ತೇನೆ",
  // A bad translation on purpose: ₹200 became ₹2000, so Ravi's phone must withhold it.
  [pairKey(hi, kn, HI_NOTE_GAS)]: "ಗ್ಯಾಸ್‌ಗೆ ₹2000 ಹೆಚ್ಚುವರಿ",
  [pairKey(hi, en, HI_ABOUT_MAID)]: "Sweeping, mopping, dishes",
  [pairKey(en, hi, EN_NEED)]: "रोज़ झाड़ू, पोछा और बर्तन",
  [pairKey(en, hi, EN_TIME)]: "सुबह 8 बजे",
  [pairKey(en, hi, EN_ROOMS)]: "3 कमरे, झाड़ू और पोछा",
  [pairKey(hi, en, HI_NOTE_LATE)]: "I will come 15 minutes late tomorrow",
};

let contexts: BrowserContext[] = [];
let others: ApiClient[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(others.map((a) => a.removeProfile()));
  await Promise.all(contexts.map((c) => c.close()));
  others = [];
  contexts = [];
});

async function twoPhones(browser: Browser, langs: [Lang, Lang]): Promise<[Phone, Phone]> {
  contexts = [await browser.newContext(), await browser.newContext()];
  await Promise.all(contexts.map((c) => useTableTranslator(c, TABLE)));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  return [
    { page: pages[0], lang: langs[0] },
    { page: pages[1], lang: langs[1] },
  ] as [Phone, Phone];
}

const pagesOf = (phones: Record<string, Phone>) =>
  Object.fromEntries(Object.entries(phones).map(([k, p]) => [k, p.page]));

test("Hindi cook, Kannada household: every screen in its own language, free text translated both ways", async ({
  browser,
}) => {
  const folder = "hindi-kannada";
  const [asha, ravi] = await twoPhones(browser, [hi, kn]);
  const phones = { worker: asha, customer: ravi };
  const shots = pagesOf(phones);
  const ashaName = `Asha ${RUN}`;
  const address = `12, 4th Block, Jayanagar (${RUN})`;
  others = [
    await listWorker(`Meena ${RUN}`, ["cook"], { lat: JAYANAGAR.lat + 0.02, lon: JAYANAGAR.lon }, 900000, {
      area_name: "Jayanagar",
      languages: ["kn"],
    }),
  ];

  // First launch: the language screen speaks all three; each person picks theirs.
  await Promise.all([asha.page.goto("/"), ravi.page.goto("/")]);
  await shoot("choose-language", shots, folder);
  await signIn(asha.page, { role: Role.worker, name: ashaName, phone: newPhone(), lang: hi });
  await signIn(ravi.page, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone(), address, lang: kn });

  await publishCard(asha, {
    trade: t(hi, "trade.cook"),
    area: "jayanagar",
    rate: "९५००", // typed in Devanagari digits
    min: "8000",
    about: HI_ABOUT_COOK,
    askFirst: true,
  });
  await fillAsk(ravi, {
    trade: "cook",
    area: "Jayanagar",
    worker: ashaName,
    need: KN_NEED,
    when: "when.daily",
    time: KN_TIME,
    budget: "9500",
  });
  const card = ravi.page.getByLabel(t(kn, "a11y.worker", { name: ashaName }));
  await expect(card).toContainText(t(kn, "lang.hi"));
  // Her Hindi "about", translated on his phone and shown in his language only.
  await expect(card.locator(TRANSLATED)).toHaveText("ಉತ್ತರ ಮತ್ತು ದಕ್ಷಿಣ ಭಾರತೀಯ ಅಡುಗೆ");
  await expect(card).not.toContainText(HI_ABOUT_COOK);
  await shoot("card-and-search", shots, folder);
  await ravi.page.getByRole("button", { name: plural(kn, "find.ask", 1) }).click();

  // Asha's agent asks the cook's questions as keys; Ravi reads and answers them in Kannada, pets from a toggle.
  await open(asha.page, "nav.activity", hi);
  const answer = ravi.page.getByRole("form", { name: t(kn, "a11y.answer") });
  await expect(answer.getByLabel(questionText(kn, "pets"))).toBeVisible();
  await shoot("questions-in-kannada", shots, folder);
  await answer.getByLabel(questionText(kn, "people")).fill("೩");
  await answer.getByLabel(questionText(kn, "meals")).fill(KN_MEALS);
  await answer.getByLabel(questionText(kn, "pets")).selectOption("yes");
  await answer.getByRole("button", { name: t(kn, "job.send_answers") }).click();

  // Asha reads Ravi's words only in Hindi, and her agent stops for the dog with its plan.
  const job = asha.page.getByRole("article");
  await expect(job.locator(TRANSLATED).filter({ hasText: "सुबह खाना बनाने वाले चाहिए" })).toBeVisible();
  // His answers to the agent's questions are with the job's other details, under its Details fold.
  // It is in the agents' talk (his answer to her agent's question) and again under Details.
  await expect(job.getByRole("list", { name: t(hi, "talk.title") })).toContainText("सुबह और रात");
  await reveal(asha.page, job.locator(".job-more").locator(TRANSLATED).filter({ hasText: "सुबह और रात" }));
  await expect(job.locator(TRANSLATED).filter({ hasText: "सुबह 7–10" }).first()).toBeVisible(); // the time he gave
  await expect(job).not.toContainText(KN_NEED);
  await expect(job).not.toContainText(KN_MEALS);
  const check = asha.page.getByRole("group", { name: t(hi, "a11y.approve") });
  await expect(check).toBeVisible();
  // The plan is under the card's Details.
  const plan = asha.page.getByRole("group", { name: t(hi, "a11y.plan") });
  await reveal(asha.page, plan);
  await expect(plan).toContainText("₹12,600"); // the band's high with the dog and the extra person
  await shoot("asha-checks-the-dog", shots, folder);
  // Her agent opens at a point drawn for this job inside that range (ADR 0033), so the button's price varies.
  await check.getByRole("button", { name: textOf(hi, "approve.yes") }).click();

  await signBoth(phones, folder);
  await expect(ravi.page.getByLabel(t(kn, "a11y.contact"))).toContainText(ashaName);
  await expect(asha.page.getByLabel(t(hi, "a11y.contact"))).toContainText(address);
  const price = await dealPaise(ravi);
  expect(price).toBeGreaterThanOrEqual(800000);
  expect(price).toBeLessThanOrEqual(950000);
  expect(await dealPaise(asha)).toBe(price);
  await shoot("signed-contacts", shots, folder);

  // A coded note reads natively; her own words are translated; a translation that changed ₹200 is withheld.
  await asha.page.getByRole("button", { name: t(hi, "update.on_my_way") }).click();
  await sendNote(asha, HI_NOTE_GATE);
  await sendNote(asha, HI_NOTE_GAS);
  const notes = ravi.page.getByRole("list", { name: t(kn, "a11y.notes") });
  await expect(notes).toContainText(t(kn, "update.on_my_way"));
  await expect(notes).toContainText("10 ನಿಮಿಷದಲ್ಲಿ ಗೇಟ್ ತಲುಪುತ್ತೇನೆ");
  // The withheld one shows his phone's reason beside her own Hindi, never the changed number.
  const gas = notes.getByRole("listitem").filter({ hasText: HI_NOTE_GAS });
  await expect(gas.locator(ORIGINAL)).toHaveText(HI_NOTE_GAS);
  await expect(gas).toContainText(t(kn, "said.unsafe", { lang: t(kn, "lang.hi") }));
  await expect(notes).not.toContainText("₹2000");
  await shoot("notes-translated", shots, folder);

  // Every line of Ravi's on her card is in Hindi alone: no Kannada, and no note about it. The day is her phone's own
  // word for it; the signed slot, a copy of the request's "when", is not shown beside it.
  await expect(job).toContainText(DEVANAGARI);
  await expect(job).not.toContainText(KANNADA);
  await expect(job).not.toContainText(OLD_NOTE);

  await open(asha.page, "nav.about", hi);
  await expect(asha.page.getByRole("region", { name: t(hi, "profile.language") })).toBeVisible();
  await shoot("settings", shots, folder);
  await openCard(asha.page, hi);
  await asha.page.getByRole("button", { name: t(hi, "card.unlist") }).click();
});

test("Hindi maid, English household: rooms priced from the band, words translated each way", async ({ browser }) => {
  const folder = "hindi-english";
  const [sunita, meera] = await twoPhones(browser, [hi, en]);
  const phones = { worker: sunita, customer: meera };
  const shots = pagesOf(phones);
  const sunitaName = `Sunita ${RUN}`;
  const address = `Flat 7B, 27th Main, HSR Layout (${RUN})`;

  await signIn(sunita.page, { role: Role.worker, name: sunitaName, phone: newPhone(), lang: hi });
  await signIn(meera.page, { role: Role.consumer, name: `Meera ${RUN}`, phone: newPhone(), address, lang: en });
  await publishCard(sunita, {
    trade: t(hi, "trade.maid"),
    area: "hsr_layout",
    rate: "7000",
    min: "5000",
    about: HI_ABOUT_MAID,
  });
  await fillAsk(meera, {
    trade: "maid",
    area: "HSR Layout",
    worker: sunitaName,
    need: EN_NEED,
    when: "when.daily",
    time: EN_TIME,
    budget: "7000",
  });
  await meera.page.getByLabel(questionText(en, "rooms")).fill(EN_ROOMS);
  await expect(meera.page.getByLabel(t(en, "a11y.worker", { name: sunitaName })).locator(TRANSLATED)).toHaveText(
    "Sweeping, mopping, dishes",
  );
  await shoot("card-and-search", shots, folder);
  await meera.page.getByRole("button", { name: plural(en, "find.ask", 1) }).click();

  // Rooms came with the ask; Sunita's agent asks only about pets, which Meera reads in English.
  await open(sunita.page, "nav.activity", hi);
  const answer = meera.page.getByRole("form", { name: t(en, "a11y.answer") });
  await expect(answer.getByLabel(questionText(en, "pets"))).toBeVisible();
  await shoot("question-in-english", shots, folder);
  await answer.getByLabel(questionText(en, "pets")).selectOption("no");
  await answer.getByRole("button", { name: t(en, "job.send_answers") }).click();

  // One room beyond the band's two: 15% more, ₹4,030–₹9,200, and her own ₹5,000 floor; she reads it in Hindi.
  // The plan is under the card's Details, and the card is folded under the agents' talks while they negotiate.
  const plan = sunita.page.getByRole("group", { name: t(hi, "a11y.plan") });
  await reveal(sunita.page, plan);
  await expect(plan).toContainText("₹9,200");
  await expect(sunita.page.getByRole("article").locator(TRANSLATED).filter({ hasText: "3 कमरे" })).toHaveText(
    "3 कमरे, झाड़ू और पोछा",
  );
  await signBoth(phones, folder);
  await expect(meera.page.getByLabel(t(en, "a11y.contact"))).toContainText(sunitaName);
  await expect(sunita.page.getByLabel(t(hi, "a11y.contact"))).toContainText(address);
  const price = await dealPaise(meera);
  expect(price).toBeGreaterThanOrEqual(500000);
  expect(price).toBeLessThanOrEqual(700000);
  await shoot("signed-contacts", shots, folder);

  await sunita.page.getByRole("button", { name: t(hi, "update.on_my_way") }).click();
  await sendNote(sunita, HI_NOTE_LATE);
  const notes = meera.page.getByRole("list", { name: t(en, "a11y.notes") });
  await expect(notes).toContainText(t(en, "update.on_my_way"));
  await expect(notes).toContainText("I will come 15 minutes late tomorrow");
  await shoot("notes-translated", shots, folder);

  await openCard(sunita.page, hi);
  await sunita.page.getByRole("button", { name: t(hi, "card.unlist") }).click();
});
