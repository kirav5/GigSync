import { HttpMethod, t } from "@gigsync/core";
import { Lang, MyQr, type QrCode } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import jsQR from "jsqr";
import { tellNeed } from "./findChat.js";
import {
  API,
  APP,
  chooseLanguage,
  completeSignIn,
  navRow,
  newPhone,
  open,
  openCard,
  Role,
  RUN,
  shoot,
  signIn,
} from "./helpers.js";
import { publishCard, unlistCards } from "./journey.js";

/**
 * Personal QR codes (ADR 0034) through the app's screens, against the real API and mailbox: my QR shows, scans, downloads
 * and keeps one code while the card behind it changes; a household opens a worker's QR link and asks them; a worker opens a household's link and offers, and the
 * household asks from My jobs. Each test signs in new numbers, well inside the API's caps on lookups and offers.
 */

const en = Lang.enum.en;
const anilName = `Anand ${RUN}`;
const priyaFirst = "Priya";
const priyaName = `${priyaFirst} ${RUN}`;
const ADDRESS = `Flat 7, 2nd Cross (${RUN})`;
const ABOUT = "Wiring, fans and switchboards";
const FOLDER = "qr";
/** The route that answers the owner's live code: `PUT` gets it, made on first ask. */
const MY_QR = `${API}/v1/qr/me`;
/** Where a worker's card goes on the board. */
const BOARD_PROFILE = `${API}/v1/board/profile`;

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

/** Opens My card from the menu, where the QR is, waits for the QR, and gives the live code it shows. */
async function openMyQr(page: Page, name: string, shot?: string): Promise<QrCode> {
  const code = codeFrom(page, HttpMethod.put, MY_QR);
  await open(page, "nav.card");
  await expect(page.getByRole("img", { name: t(en, "qr.alt", { name }) })).toBeVisible();
  if (shot) await shoot(shot, { [shot]: page }, FOLDER);
  return code;
}

const ask = (page: Page, name: string) => page.getByRole("button", { name: t(en, "qr.ask", { name }) });

/** In the chat addressed to the household's chosen worker, says the need and sends it to them alone. */
async function sendAsk(page: Page, worker: string) {
  await expect(page.getByRole("log")).toContainText(t(en, "need.start_to", { name: worker }));
  await tellNeed(
    { page, lang: en },
    { area: "Indiranagar", need: "Need an electrician", when: "when.today", budget: "650" },
  );
  // His agent got the request: it asks what is wrong (she skipped it in the chat), which only Priya can answer.
  await expect(page.getByRole("form", { name: t(en, "a11y.answer") })).toBeVisible();
}

/**
 * What a camera reads off the QR as the screen draws it (its white margin and any rounding included, not the picture
 * file): the element's screenshot, turned back into pixels in the page, read by jsQR here.
 */
async function scanOnScreen(page: Page, name: string): Promise<string | undefined> {
  const shot = await page.getByRole("img", { name: t(en, "qr.alt", { name }) }).screenshot();
  const picture = await page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context?.drawImage(image, 0, 0);
    const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data ?? [];
    return { width: canvas.width, height: canvas.height, pixels: Array.from(pixels) };
  }, shot.toString("base64"));
  return jsQR(Uint8ClampedArray.from(picture.pixels), picture.width, picture.height)?.data;
}

test("my QR shows, scans as drawn, downloads and copies, and keeps one code: there is no Make a new QR", async ({
  browser,
}) => {
  const [priya, anil] = await pages(browser);
  await signIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: ADDRESS });
  const code = await openMyQr(priya, priyaName, "profile");
  await expect(priya.getByText(t(en, "qr.about_household"))).toBeVisible();
  // A plain square with a quiet margin: the corner squares a camera finds the code by are whole on screen.
  expect(await scanOnScreen(priya, priyaName)).toContain(`to=${code}`);
  const download = priya.waitForEvent("download");
  await priya.getByRole("link", { name: t(en, "qr.download") }).click();
  expect((await download).suggestedFilename()).toBe("gigsync-qr.png");
  await priya.getByRole("button", { name: t(en, "qr.copy") }).click();
  await expect(priya.getByRole("status").filter({ hasText: /Link copied|did not allow copying/ })).toBeVisible();
  await expect(priya.getByRole("button", { name: /new QR/i })).toHaveCount(0);
  await shoot("my-qr", { household: priya }, FOLDER);

  // Opened again, it is the same code: nothing to re-issue.
  expect(await openMyQr(priya, priyaName)).toBe(code);
  await signIn(anil, { role: Role.worker, name: anilName, phone: newPhone() });
  await anil.goto(`${APP}/?to=${code}`);
  await expect(anil.getByRole("region", { name: priyaFirst })).toBeVisible();
});

test("a worker changes his card and the QR he already shared shows the change, with no new QR", async ({ browser }) => {
  const [anil, priya] = await pages(browser);
  await anilWithCard(anil);
  const code = await openMyQr(anil, anilName);
  await signIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: ADDRESS });
  await priya.goto(`${APP}/?to=${code}`);
  await expect(priya.getByText(ABOUT)).toBeVisible();

  const changed = "Fans, inverters and new wiring";
  await openCard(anil, en);
  const form = anil.getByRole("form", { name: t(en, "a11y.my_card") });
  await form.getByLabel(t(en, "card.about")).fill(changed);
  const saved = anil.waitForResponse(
    (r) => r.url() === BOARD_PROFILE && r.request().method() === HttpMethod.put && r.ok(),
  );
  await anil.getByRole("button", { name: t(en, "card.publish"), exact: true }).click();
  await saved;
  expect(await openMyQr(anil, anilName)).toBe(code);

  await priya.goto(`${APP}/?to=${code}`);
  await expect(priya.getByText(changed)).toBeVisible();
  await expect(priya.getByText(ABOUT)).toHaveCount(0);
  await shoot("qr-follows-card", { worker: anil, household: priya }, FOLDER);
});

test("a household opens a worker's QR link before signing in, and asks him", async ({ browser }) => {
  const [anil, priya] = await pages(browser);
  await anilWithCard(anil);
  const code = await openMyQr(anil, anilName);
  await expect(anil.getByText(t(en, "qr.about_worker", { name: "Anand" }))).toBeVisible();

  // Her phone's camera opens the link; she signs in first, and the app keeps the link for after.
  await priya.goto(`${APP}/?to=${code}`);
  await expect(priya).not.toHaveURL(/to=/);
  await chooseLanguage(priya, en);
  // No address here: saving one goes through Settings and would leave the link's screen (ADR 0045).
  await completeSignIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone() });
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
  await signIn(priya, {
    role: Role.consumer,
    name: priyaName,
    phone: newPhone(),
    address: ADDRESS,
    area: "Indiranagar",
  });
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
  await expect(navRow(priya, "nav.my_jobs")).toContainText("1");
  await shoot("offer-today", { worker: anil, household: priya }, FOLDER);
  await offer.getByRole("button", { name: t(en, "qr.offer_ask") }).click();
  await sendAsk(priya, anilName);
  await open(priya, "nav.my_jobs");
  await expect(offer).toHaveCount(0);
  await shoot("offer-asked", { worker: anil, household: priya }, FOLDER);
});

test("my QR shows at once on a second open, from the code kept on the phone, before the server answers", async ({
  browser,
}) => {
  const [priya] = await pages(browser);
  await signIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: ADDRESS });
  const qr = priya.getByRole("img", { name: t(en, "qr.alt", { name: priyaName }) });
  await open(priya, "nav.card");
  await expect(qr).toBeVisible();
  const first = await qr.getAttribute("src");
  await open(priya, "nav.find");

  // The server is slow now: its answer is held until the QR is already on screen.
  let release: () => void = () => undefined;
  const held = new Promise<void>((done) => (release = done));
  let asked = false;
  await priya.route(MY_QR, async (route) => {
    asked = true;
    await held;
    await route.continue();
  });
  await open(priya, "nav.card");
  await expect(qr).toBeVisible();
  expect(asked).toBe(true);
  expect(await qr.getAttribute("src")).toBe(first);
  release();
  await shoot("qr-at-once", { household: priya }, FOLDER);
});
