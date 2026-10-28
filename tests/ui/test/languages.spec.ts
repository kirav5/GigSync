import { type ApiClient, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { listWorker, newPhone, open, Role, RUN, shoot, signIn } from "./helpers.js";

/**
 * Agent-flows §1 through the app's real screens: a Hindi-speaking worker and a household that speaks Kannada, then
 * one that speaks English. Each phone shows the job in its owner's language; what crosses between them is keys,
 * numbers and signed terms. The worker's agent prices from the city's rates; nobody shares a language.
 */

const KORAMANGALA = { lat: 12.9352, lon: 77.6245 };
const { hi, kn, en } = Lang.enum;

let contexts: BrowserContext[] = [];
let others: ApiClient[] = [];

test.afterEach(async () => {
  await Promise.all(others.map((a) => a.removeProfile()));
  await Promise.all(contexts.map((c) => c.close()));
  others = [];
  contexts = [];
});

async function twoPhones(browser: import("@playwright/test").Browser): Promise<[Page, Page]> {
  contexts = [await browser.newContext(), await browser.newContext()];
  return (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
}

/** The worker publishes their card; `askFirst` ticks "ask me before quoting" for pets. */
async function publishCard(
  page: Page,
  card: { trade: string; area: string; rate: string; min: string; vpa: string; about: string; askFirst?: boolean },
) {
  const form = page.getByRole("form", { name: "My card" });
  await form.getByRole("button", { name: card.trade, exact: true }).click();
  await form.getByLabel("Where I work").selectOption(card.area);
  await form.getByLabel(/^Usual rate/).fill(card.rate);
  await form.getByLabel(/^Lowest I will take/).fill(card.min);
  await form.getByLabel(/^UPI ID/).fill(card.vpa);
  await form.getByLabel("About my work").fill(card.about);
  if (card.askFirst) await form.getByRole("checkbox", { name: "Ask me first: pets" }).check();
  await form.getByRole("button", { name: "Publish my card" }).click();
  await expect(form.getByText(/On the board:/)).toBeVisible();
}

/** The household searches, picks only `worker`, and fills the ask; the caller presses the button after a screenshot. */
async function fillAsk(
  page: Page,
  ask: { trade: string; area: string; worker: string; need: string; when: string; budget: string },
) {
  await page.getByLabel("Trade").selectOption(ask.trade);
  await page.getByLabel("Area").selectOption(ask.area);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByLabel(`Worker ${ask.worker}`)).toBeVisible();
  for (const box of await page.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await page.getByRole("checkbox", { name: `Ask ${ask.worker}` }).check();
  await page.getByLabel("What you need").fill(ask.need);
  await page.getByLabel("When").fill(ask.when);
  await page.getByLabel(/^Most I will pay/).fill(ask.budget);
}

const signGroup = (p: Page) => p.getByRole("group", { name: "Sign the deal" });

/** Each owner signs when their phone asks: whichever agent accepted first, then the other. Screens after each. */
async function signBoth(phones: Record<string, Page>, folder: string) {
  const all = Object.values(phones);
  await expect(async () => {
    const seen = await Promise.all(all.map((p) => signGroup(p).isVisible()));
    expect(seen.some(Boolean)).toBe(true);
  }).toPass();
  const first = (await Promise.all(all.map((p) => signGroup(p).isVisible()))).indexOf(true);
  const [a, b] = [all[first] as Page, all[1 - first] as Page];
  await shoot("agents-agree", phones, folder);
  await signGroup(a).getByRole("button").first().click();
  await expect(signGroup(b)).toBeVisible();
  await shoot("one-signed", phones, folder);
  await signGroup(b).getByRole("button").first().click();
}

/** The signed price in paise, read from the deal line in any language ("₹9,200"). */
async function dealPaise(page: Page): Promise<number> {
  const text = (await page.getByLabel("Deal").textContent()) ?? "";
  return Number(text.match(/₹([\d,]+)/)?.[1]?.replaceAll(",", "")) * 100;
}

test("a Hindi-speaking cook and a Kannada-speaking household: ask, check the dog, agree, sign, note", async ({
  browser,
}) => {
  const folder = "hindi-kannada";
  const [asha, ravi] = await twoPhones(browser);
  const phones = { worker: asha, customer: ravi };
  const ashaName = `Asha ${RUN}`;
  const address = `12, 4th Block, Koramangala (${RUN})`;
  others = [
    await listWorker(`Meena ${RUN}`, ["cook"], { lat: KORAMANGALA.lat + 0.02, lon: KORAMANGALA.lon }, 900000, {
      area_name: "Koramangala",
      languages: ["kn"],
    }),
  ];

  await signIn(asha, { role: Role.worker, name: ashaName, phone: newPhone(), lang: hi });
  await signIn(ravi, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone(), address, lang: kn });
  await publishCard(asha, {
    trade: "Cook",
    area: "Koramangala",
    rate: "9500",
    min: "8000",
    vpa: "asha.test@okaxis",
    about: "North and South Indian cooking",
    askFirst: true,
  });
  await fillAsk(ravi, {
    trade: "cook",
    area: "Koramangala",
    worker: ashaName,
    need: "ಬೆಳಗ್ಗೆ ಅಡುಗೆ ಮಾಡುವವರು ಬೇಕು",
    when: "ಸೋಮ–ಶನಿ ಬೆಳಗ್ಗೆ 7–10",
    budget: "9500",
  });
  await expect(ravi.getByLabel(`Worker ${ashaName}`)).toContainText(t(kn, "lang.hi"));
  await shoot("card-and-search", phones, folder);
  await ravi.getByRole("button", { name: "Ask 1 worker" }).click();

  // Asha's agent asks the cook's questions as keys; Ravi reads them in Kannada and answers, pets from a toggle.
  await open(asha, "Requests");
  const answer = ravi.getByRole("form", { name: "Answer the worker" });
  await expect(answer.getByLabel(questionText(kn, "pets"))).toBeVisible();
  await shoot("questions-in-kannada", phones, folder);
  await answer.getByLabel(questionText(kn, "people")).fill("೩");
  await answer.getByLabel(questionText(kn, "meals")).fill("ಬೆಳಗ್ಗೆ ಮತ್ತು ರಾತ್ರಿ");
  await answer.getByLabel(questionText(kn, "pets")).selectOption("yes");
  await answer.getByRole("button", { name: t(kn, "job.send_answers") }).click();

  // A dog is on Asha's "ask me first" list: her agent shows her its plan, in Hindi, and quotes nothing yet.
  const check = asha.getByRole("group", { name: "Approve the request" });
  await expect(check).toBeVisible();
  await expect(asha.getByRole("group", { name: "Plan" })).toContainText("₹10,930");
  await expect(asha.getByRole("list", { name: "Offers" })).toHaveCount(0);
  await shoot("asha-checks-the-dog", phones, folder);
  await check.getByRole("button", { name: t(hi, "approve.yes", { price: "₹10,930" }) }).click();

  await signBoth(phones, folder);
  await expect(ravi.getByLabel("Contact")).toContainText(ashaName);
  await expect(asha.getByLabel("Contact")).toContainText(address);
  const price = await dealPaise(ravi);
  expect(price).toBeGreaterThanOrEqual(863000);
  expect(price).toBeLessThanOrEqual(950000);
  expect(await dealPaise(asha)).toBe(price);
  await shoot("signed-contacts", phones, folder);

  // Asha's note goes as she wrote it, tagged Hindi; Ravi's phone shows it with the language named in Kannada.
  await asha.getByRole("button", { name: t(hi, "job.on_my_way") }).click();
  const notes = ravi.getByRole("list", { name: "Notes" });
  await expect(notes).toContainText(t(hi, "job.on_my_way"));
  await expect(notes).toContainText(t(kn, "job.said_in", { lang: t(kn, "lang.hi") }));
  await shoot("note-in-hindi", phones, folder);

  await open(asha, "My card");
  await asha.getByRole("button", { name: "Take my card off the board" }).click();
});

test("a Hindi-speaking maid and an English-speaking household: rooms priced from the band, agree, sign, note", async ({
  browser,
}) => {
  const folder = "hindi-english";
  const [sunita, meera] = await twoPhones(browser);
  const phones = { worker: sunita, customer: meera };
  const sunitaName = `Sunita ${RUN}`;
  const address = `Flat 7B, 27th Main, HSR Layout (${RUN})`;

  await signIn(sunita, { role: Role.worker, name: sunitaName, phone: newPhone(), lang: hi });
  await signIn(meera, { role: Role.consumer, name: `Meera ${RUN}`, phone: newPhone(), address, lang: en });
  await publishCard(sunita, {
    trade: "Maid",
    area: "HSR Layout",
    rate: "7000",
    min: "5000",
    vpa: "sunita.test@okaxis",
    about: "Sweeping, mopping, dishes",
  });
  await fillAsk(meera, {
    trade: "maid",
    area: "HSR Layout",
    worker: sunitaName,
    need: "Daily sweeping, mopping and dishes",
    when: "Mon–Sat 8am",
    budget: "7000",
  });
  await meera.getByLabel(questionText(en, "rooms")).fill("3 rooms, sweeping and mopping");
  await expect(meera.getByLabel(`Worker ${sunitaName}`)).toContainText(t(en, "lang.hi"));
  await shoot("card-and-search", phones, folder);
  await meera.getByRole("button", { name: "Ask 1 worker" }).click();

  // Rooms came with the ask; Sunita's agent asks only about pets, which Meera reads in English.
  await open(sunita, "Requests");
  const answer = meera.getByRole("form", { name: "Answer the worker" });
  await expect(answer.getByLabel(questionText(en, "pets"))).toBeVisible();
  await shoot("question-in-english", phones, folder);
  await answer.getByLabel(questionText(en, "pets")).selectOption("no");
  await answer.getByRole("button", { name: t(en, "job.send_answers") }).click();

  // One room beyond the band's two: 10% more, so ₹5,500–₹7,700; Sunita reads why in Hindi.
  await expect(sunita.getByRole("group", { name: "Plan" })).toContainText("₹7,700");
  await signBoth(phones, folder);
  await expect(meera.getByLabel("Contact")).toContainText(sunitaName);
  await expect(sunita.getByLabel("Contact")).toContainText(address);
  const price = await dealPaise(meera);
  expect(price).toBeGreaterThanOrEqual(550000);
  expect(price).toBeLessThanOrEqual(700000);
  await shoot("signed-contacts", phones, folder);

  await sunita.getByRole("button", { name: t(hi, "job.on_my_way") }).click();
  const notes = meera.getByRole("list", { name: "Notes" });
  await expect(notes).toContainText(t(hi, "job.on_my_way"));
  await expect(notes).toContainText(t(en, "job.said_in", { lang: t(en, "lang.hi") }));
  await shoot("note-in-hindi", phones, folder);

  await open(sunita, "My card");
  await sunita.getByRole("button", { name: "Take my card off the board" }).click();
});
