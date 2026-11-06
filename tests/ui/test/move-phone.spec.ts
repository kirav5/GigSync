import { plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import jsQR from "jsqr";
import { skipPriceQuestions } from "./findChat.js";
import {
  drawer,
  MovePrompt,
  newPhone,
  open,
  openCard,
  openDrawer,
  Role,
  RUN,
  setUpi,
  shoot,
  signIn,
  textOf,
} from "./helpers.js";
import { type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * Moving to a new phone and a card coming back (ADR 0037 §3, §4), through the app's screens against the real API: two
 * browser contexts are the same person's old and new phone, signed in with the same number. The new phone cannot point
 * a camera at the old one, so the test reads the old phone's QR picture itself and hands its text to the dev build's
 * scripted scan (adapters/scan-fake.ts); the QR, the slot, the encryption and the sign-out of the old phone are real.
 */

const { en } = Lang.enum;
const FOLDER = "move-phone";
/** The dev build's scripted scan (adapters/scan-fake.ts). */
const FAKE_SCAN_KEY = "gigsync-fake-scan";
const ROOMS = "3 rooms, sweeping and mopping";
const ABOUT = "Wiring, fans and switchboards";
/** The old phone notices the new one took over within a few of its 3-second checks. */
const MOVED_MS = 60_000;

let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function pages(browser: { newContext: () => Promise<BrowserContext> }, n: number): Promise<Page[]> {
  contexts = await Promise.all(Array.from({ length: n }, () => browser.newContext()));
  return Promise.all(contexts.map((c) => c.newPage()));
}

/** Old phone: Settings › Move to a new phone › Show my code; gives the text its QR picture carries. */
async function showMoveCode(page: Page): Promise<string> {
  await open(page, "nav.settings");
  await page.getByRole("button", { name: textOf(en, "phone.move_out") }).click();
  await page.getByRole("button", { name: t(en, "phone.out_start") }).click();
  const qr = page.getByRole("img", { name: t(en, "phone.out_qr_alt") });
  await expect(qr).toBeVisible();
  await expect(page.getByRole("timer")).toContainText(/1[45]:\d\d/);
  const picture = await qr.evaluate(async (el) => {
    const image = el as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    context?.drawImage(image, 0, 0);
    const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data ?? [];
    return { width: canvas.width, height: canvas.height, pixels: Array.from(pixels) };
  });
  const read = jsQR(Uint8ClampedArray.from(picture.pixels), picture.width, picture.height);
  expect(read?.data).toMatch(/^gigsync-move:xfr_/);
  return read?.data ?? "";
}

/** New phone, on "Moving from another phone?": scans the old phone's code and waits until its records are here. */
async function scanMoveCode(page: Page, code: string) {
  await page.evaluate(([key, text]) => localStorage.setItem(key, text), [FAKE_SCAN_KEY, code] as const);
  await page.getByRole("button", { name: t(en, "phone.in_scan") }).click();
  await expect(page.getByRole("status").filter({ hasText: t(en, "phone.in_done") })).toBeVisible();
}

/** Old phone: says it moved once the new phone signed it out, and OK leaves it at the sign-in screen. */
async function oldPhoneMoved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: t(en, "phone.out_done") })).toBeVisible({
    timeout: MOVED_MS,
  });
}

async function signedOutAfterMove(page: Page) {
  await page.getByRole("button", { name: t(en, "phone.out_ok") }).click();
  await expect(page.getByRole("form", { name: t(en, "signin.label") })).toBeVisible();
}

/** The household's Find chat: says a few words, or taps a choice under the newest question. */
async function say(page: Page, words: string) {
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
}
const tap = (page: Page, label: string) =>
  page.getByRole("log").getByRole("button", { name: label, exact: true }).click();

/** Priya asks Meena for a maid in Find's chat; Meena's agent asks about pets, Priya answers, and both sign. */
async function signedJob(meena: Phone, priya: Phone, meenaName: string) {
  const page = priya.page;
  await open(page, "nav.find");
  await expect(page.getByRole("log")).toContainText(t(en, "need.start"));
  await tap(page, t(en, "need.pick_work"));
  await tap(page, t(en, "trade.maid"));
  await say(page, ROOMS);
  await tap(page, t(en, "need.arr.monthly"));
  await skipPriceQuestions(priya);
  // Every day, at an hour (ADR 0050 §1): any time.
  await tap(page, t(en, "when.any_time"));
  await say(page, "7000");
  await tap(page, t(en, "flag.yes"));
  const found = page.getByRole("group", { name: t(en, "a11y.ask_workers") });
  await expect(found.getByLabel(t(en, "a11y.worker", { name: meenaName }))).toBeVisible();
  for (const box of await found.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await found.getByRole("checkbox", { name: t(en, "a11y.ask_worker", { name: meenaName }) }).check();
  await found.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  await open(meena.page, "nav.activity");
  await open(page, "nav.my_jobs");
  const answer = page.getByRole("form", { name: t(en, "a11y.answer") });
  await answer.getByLabel(questionText(en, "pets")).selectOption("no");
  await answer.getByRole("button", { name: t(en, "job.send_answers") }).click();
  await signBoth({ worker: meena, customer: priya }, FOLDER);
  await open(page, "nav.my_jobs");
  await expect(page.getByLabel(t(en, "a11y.contact"))).toContainText(meenaName);
}

const chatList = (page: Page) => drawer(page).getByRole("region", { name: t(en, "chats.title") });
const memory = (page: Page) => page.getByRole("region", { name: t(en, "memory.title") });

test("a household moves to a new phone by QR: the job, memory and chats arrive, and the old phone is signed out", async ({
  browser,
}) => {
  const [meenaPage, oldPage, newPage] = (await pages(browser, 3)) as [Page, Page, Page];
  const meenaName = `Meena ${RUN}`;
  const priya = { role: Role.consumer, name: `Priya ${RUN}`, phone: newPhone(), address: `Flat 4 (${RUN})` };
  await signIn(meenaPage, { role: Role.worker, name: meenaName, phone: newPhone() });
  await publishCard(
    { page: meenaPage, lang: en },
    { trade: t(en, "trade.maid"), area: "hsr_layout", rate: "7000", min: "5000", about: "Rooms" },
  );
  await signIn(oldPage, priya);
  await signedJob({ page: meenaPage, lang: en }, { page: oldPage, lang: en }, meenaName);
  await openDrawer(oldPage);
  const chatTitle = (await chatList(oldPage).locator(".session-title").first().textContent()) ?? "";
  expect(chatTitle).not.toBe("");

  // The new phone, signed in with the same number, asks at once whether she is moving from another phone.
  await signIn(newPage, { ...priya, elsewhere: MovePrompt.wait });
  await expect(newPage.getByRole("button", { name: t(en, "phone.in_scan") })).toBeVisible();
  const code = await showMoveCode(oldPage);
  await shoot("code-and-prompt", { old: oldPage, new: newPage }, FOLDER);

  await scanMoveCode(newPage, code);
  await oldPhoneMoved(oldPage);
  await shoot("moved", { old: oldPage, new: newPage }, FOLDER);
  await signedOutAfterMove(oldPage);

  await newPage.getByRole("button", { name: t(en, "phone.in_continue") }).click();
  await open(newPage, "nav.my_jobs");
  await expect(newPage.getByLabel(t(en, "a11y.contact"))).toContainText(meenaName);
  await open(newPage, "nav.about");
  await expect(memory(newPage)).toContainText(ROOMS);
  await openDrawer(newPage);
  await expect(chatList(newPage)).toContainText(chatTitle);
  await shoot("arrived", { new: newPage }, FOLDER);
});

test("a worker's card comes back on a new phone, and moving brings the lowest price and the UPI ID", async ({
  browser,
}) => {
  const [oldPage, newPage] = (await pages(browser, 2)) as [Page, Page];
  const anil = { role: Role.worker, name: `Arun ${RUN}`, phone: newPhone() };
  const upi = `anil${RUN}@okaxis`;
  await signIn(oldPage, anil);
  await publishCard(
    { page: oldPage, lang: en },
    { trade: t(en, "trade.electrician"), area: "indiranagar", rate: "700", min: "550", about: ABOUT },
  );
  await setUpi(oldPage, en, upi);

  // A fresh sign-in on another phone: not moving yet. The card comes back from the board; only the lowest price is asked.
  await signIn(newPage, { ...anil, elsewhere: MovePrompt.notNow });
  await open(newPage, "nav.activity");
  const floor = newPage.getByRole("form", { name: t(en, "phone.floor_title") });
  await expect(floor).toContainText(t(en, "phone.floor_about"));
  await shoot("card-back", { new: newPage }, FOLDER);
  await open(newPage, "nav.card");
  await expect(newPage.getByText(ABOUT)).toBeVisible();

  // Then she moves after all: the old phone's rules win over the refilled ones without a question.
  await open(newPage, "nav.settings");
  await newPage.getByRole("button", { name: textOf(en, "phone.move_in") }).click();
  const code = await showMoveCode(oldPage);
  await scanMoveCode(newPage, code);
  await oldPhoneMoved(oldPage);
  await signedOutAfterMove(oldPage);
  await newPage.getByRole("button", { name: t(en, "phone.in_continue") }).click();

  await open(newPage, "nav.activity");
  await expect(floor).toHaveCount(0);
  await openCard(newPage);
  await expect(newPage.getByLabel(t(en, "card.min"))).toHaveValue("550");
  await open(newPage, "nav.about");
  await expect(newPage.getByText(upi)).toBeVisible();
  await shoot("worker-moved", { new: newPage }, FOLDER);
});
