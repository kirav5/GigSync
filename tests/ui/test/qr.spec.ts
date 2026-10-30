import { HttpMethod, t } from "@gigsync/core";
import { Lang, MyQr, type QrCode } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { API, APP, chooseLanguage, completeSignIn, newPhone, open, Role, RUN, shoot, signIn, tabs } from "./helpers.js";
import { publishCard, unlistCards } from "./journey.js";

/**
 * Personal QR codes (ADR 0034) through the app's screens, against the real API and mailbox: my QR shows, downloads and
 * is replaced; a household opens a worker's QR link and asks them; a worker opens a household's link and offers, and the
 * household asks from My jobs. Each test signs in new numbers, well inside the API's caps on lookups and offers.
 */

const en = Lang.enum.en;
const anilName = `Anil ${RUN}`;
const priyaFirst = "Priya";
const priyaName = `${priyaFirst} ${RUN}`;
const ADDRESS = `Flat 7, 2nd Cross (${RUN})`;
const ABOUT = "Wiring, fans and switchboards";
const FOLDER = "qr";
/** The routes that answer the owner's live code: `PUT` gets it (made on first ask), `POST` replaces it. */
const MY_QR = `${API}/v1/qr/me`;
const REPLACE_QR = `${MY_QR}/replace`;

let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function pages(browser: { newContext: () => Promise<BrowserContext> }): Promise<[Page, Page]> {
  contexts = [await browser.newContext(), await browser.newContext()];
  return (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
}

/**
 * The code the API gives this page's next `method` request to `url`, the one its QR then shows: the picture carries it
 * only as pixels, and copying the link is not allowed in every browser. Call before the step that sends it. A dev
 * build's StrictMode sends the screen's first request twice; the API keeps one live code a person, so either answer
 * that succeeded carries it.
 */
async function codeFrom(page: Page, method: string, url: string): Promise<QrCode> {
  const res = await page.waitForResponse((r) => r.url() === url && r.request().method() === method && r.ok());
  return MyQr.parse(await res.json()).code;
}

/** Anil, an electrician with a card on the board, which his QR shows. */
async function anilWithCard(page: Page) {
  await signIn(page, { role: Role.worker, name: anilName, phone: newPhone() });
  await publishCard(
    { page, lang: en },
    { trade: "Electrician", area: "indiranagar", rate: "700", min: "550", about: ABOUT },
  );
}

/** Opens My QR code from Profile's one row, waits for the QR, and gives the live code it shows. */
async function openMyQr(page: Page, name: string, shot?: string): Promise<QrCode> {
  await open(page, "nav.profile");
  if (shot) await shoot(shot, { [shot]: page }, FOLDER);
  const code = codeFrom(page, HttpMethod.put, MY_QR);
  await page.getByRole("button", { name: new RegExp(t(en, "qr.mine")) }).click();
  await expect(page.getByRole("img", { name: t(en, "qr.alt", { name }) })).toBeVisible();
  return code;
}

const ask = (page: Page, name: string) => page.getByRole("button", { name: t(en, "qr.ask", { name }) });

/** Fills the ask the household's chosen worker gets, and sends it to them alone. */
async function sendAsk(page: Page, worker: string) {
  await expect(page.getByRole("checkbox", { name: t(en, "a11y.ask_worker", { name: worker }) })).toBeChecked();
  await page.getByLabel(t(en, "find.need_label"), { exact: true }).fill("Ceiling fan stopped working");
  await page
    .getByRole("group", { name: t(en, "find.when") })
    .getByRole("button", { name: t(en, "when.today") })
    .click();
  await page.getByLabel(t(en, "find.budget")).fill("650");
  await page.getByRole("button", { name: "Ask 1 worker" }).click();
  // His agent got the request: it asks what is wrong, which only Priya can answer.
  await expect(page.getByRole("form", { name: t(en, "a11y.answer") })).toBeVisible();
}

test("my QR shows, downloads and copies; a new QR ends the old link", async ({ browser }) => {
  const [priya, anil] = await pages(browser);
  await signIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: ADDRESS });
  const old = await openMyQr(priya, priyaName, "profile");
  await expect(priya.getByText(t(en, "qr.about_household"))).toBeVisible();
  const download = priya.waitForEvent("download");
  await priya.getByRole("link", { name: t(en, "qr.download") }).click();
  expect((await download).suggestedFilename()).toBe("gigsync-qr.png");
  await priya.getByRole("button", { name: t(en, "qr.copy") }).click();
  await expect(priya.getByRole("status").filter({ hasText: /Link copied|did not allow copying/ })).toBeVisible();
  await shoot("my-qr", { household: priya }, FOLDER);

  await priya.getByRole("button", { name: t(en, "qr.new") }).click();
  const confirm = priya.getByRole("dialog", { name: t(en, "qr.new") });
  const replaced = codeFrom(priya, HttpMethod.post, REPLACE_QR);
  await confirm.getByRole("button", { name: t(en, "qr.new") }).click();
  await expect(priya.getByRole("status").filter({ hasText: t(en, "qr.new_done") })).toBeVisible();
  const next = await replaced;
  expect(next).not.toBe(old);

  await signIn(anil, { role: Role.worker, name: anilName, phone: newPhone() });
  await anil.goto(`${APP}/?to=${old}`);
  await expect(anil.getByText(t(en, "qr.ended"))).toBeVisible();
  await expect(anil).not.toHaveURL(/to=/);
  await anil.goto(`${APP}/?to=${next}`);
  await expect(anil.getByRole("region", { name: priyaFirst })).toBeVisible();
  await shoot("new-qr", { household: priya, worker: anil }, FOLDER);
});

test("a household opens a worker's QR link before signing in, and asks him", async ({ browser }) => {
  const [anil, priya] = await pages(browser);
  await anilWithCard(anil);
  const code = await openMyQr(anil, anilName);
  await expect(anil.getByText(t(en, "qr.about_worker"))).toBeVisible();

  // Her phone's camera opens the link; she signs in first, and the app keeps the link for after.
  await priya.goto(`${APP}/?to=${code}`);
  await expect(priya).not.toHaveURL(/to=/);
  await chooseLanguage(priya, en);
  await completeSignIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: ADDRESS });
  await expect(ask(priya, anilName)).toBeVisible();
  await expect(priya.getByText(ABOUT)).toBeVisible();
  await shoot("worker-qr", { worker: anil, household: priya }, FOLDER);

  await ask(priya, anilName).click();
  await sendAsk(priya, anilName);
  await shoot("asked", { worker: anil, household: priya }, FOLDER);
});

test("a worker opens a household's QR link and offers; the household asks him from My jobs", async ({ browser }) => {
  const [anil, priya] = await pages(browser);
  await anilWithCard(anil);
  await signIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: ADDRESS });
  const code = await openMyQr(priya, priyaName);

  const first = priyaFirst;
  await anil.goto(`${APP}/?to=${code}`);
  await anil.getByRole("button", { name: t(en, "qr.offer", { name: first }) }).click();
  // Whatever the screen says first (sent, or why not) is the answer.
  const said = anil.getByRole("region", { name: first }).getByRole("status").filter({ hasText: /\S/ });
  await expect(said).toHaveText(t(en, "qr.offered", { name: first }));
  await shoot("offered", { worker: anil, household: priya }, FOLDER);

  // The offer reaches her phone through the real mailbox, which let it in only because the API took it first.
  await open(priya, "nav.my_jobs");
  const line = t(en, "qr.offer_line", { name: anilName, trade: "Electrician" });
  const offer = priya.getByRole("article", { name: line });
  await expect(offer).toBeVisible();
  await expect(tabs(priya).getByRole("button", { name: new RegExp(t(en, "nav.my_jobs")) })).toContainText("1");
  await shoot("offer-today", { worker: anil, household: priya }, FOLDER);
  await offer.getByRole("button", { name: t(en, "qr.offer_ask") }).click();
  await sendAsk(priya, anilName);
  await open(priya, "nav.my_jobs");
  await expect(offer).toHaveCount(0);
  await shoot("offer-asked", { worker: anil, household: priya }, FOLDER);
});
