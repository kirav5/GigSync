import { HttpMethod, type MessageKey, type Params, plural, t } from "@gigsync/core";
import { BoardProfile, Lang, MyQr, type QrCode } from "@gigsync/protocol";
import { type BrowserContext, expect, type Locator, type Page, test } from "@playwright/test";
import { API, APP, MovePrompt, newPhone, open, Role, RUN, SHOTS, signIn } from "./helpers.js";
import { publishCard, unlistCards } from "./journey.js";
import { seedServedJobs } from "./record-seed.js";

/**
 * My card as collab's (ADR 0036): one centred card with who the owner is, a worker's record (Jobs, rating, Came
 * back), the QR and its buttons, and one Edit my card. The record is GigSync's (ADR 0038), computed from the jobs both
 * phones submitted: the same numbers on the worker's own card and on the card a household scans. The jobs here are
 * seeded through the API as two phones would leave them.
 */

const en = Lang.enum.en;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const PHONE = { width: 390, height: 844 };
const TALL_PHONE = { width: PHONE.width, height: 1400 };
const SCHEMES = ["light"] as const;
const FOLDER = "mycard";
const MY_QR = `${API}/v1/qr/me`;
const BOARD_PROFILE = `${API}/v1/board/profile`;
/** The card goes to the board again soon after the Privacy switch moves. */
const PUBLISH_MS = 30_000;
const ABOUT = "Home food, South Indian and North Indian";
/** Five jobs done for four households; four rated them 5, 4, 5 and 5. */
const RATED = [
  { household: 1, stars: 5 },
  { household: 1, stars: 4 },
  { household: 2, stars: 5 },
  { household: 3, stars: 5 },
  { household: 4 },
];

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phone(browser: { newContext: (o: object) => Promise<BrowserContext> }): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  contexts.push(context);
  return context.newPage();
}

/** My card in the light look, the whole card, under screenshots/<engine>/mycard/. */
async function shots(page: Page, name: string) {
  const dir = `${SHOTS}${test.info().project.name}/${FOLDER}/`;
  // The app scrolls inside its own panel, so a taller phone shows the whole page, down to Edit my card.
  await page.setViewportSize(TALL_PHONE);
  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    await page.screenshot({ path: `${dir}${name}-${colorScheme}.png` });
  }
  await page.emulateMedia({ colorScheme: null });
  await page.setViewportSize(PHONE);
}

/** The next card this page puts on the board that `matches`, once the board took it. */
async function published(page: Page, matches: (sent: BoardProfile) => boolean): Promise<BoardProfile> {
  const sentCard = (body: unknown) => BoardProfile.safeParse(body);
  const res = await page.waitForResponse(
    (r) => {
      if (r.url() !== BOARD_PROFILE || r.request().method() !== HttpMethod.put) return false;
      const sent = sentCard(r.request().postDataJSON());
      return sent.success && matches(sent.data);
    },
    { timeout: PUBLISH_MS },
  );
  expect(res.ok()).toBe(true);
  return BoardProfile.parse(res.request().postDataJSON());
}

const card = (page: Page, label: MessageKey) => page.getByRole("region", { name: say(label) });
const stats = (scope: Page | Locator) => scope.getByRole("definition");

async function cook(page: Page, name: string, phone = newPhone(), elsewhere?: MovePrompt) {
  await signIn(page, { role: Role.worker, name, phone, ...(elsewhere ? { elsewhere } : {}) });
  await publishCard({ page, lang: en }, { trade: "Cook", area: "jayanagar", rate: "11000", min: "9000", about: ABOUT });
}

test("a worker's My card shows their card, their record, the QR and one Edit my card", async ({ browser }) => {
  const page = await phone(browser);
  const name = `Lakshmi ${RUN}`;
  const number = newPhone();
  await seedServedJobs(number, RATED);
  // Seeding signed the number in on another device, so the move prompt comes; this cook is not moving.
  await cook(page, name, number, MovePrompt.notNow);
  await open(page, "nav.card");
  const mine = card(page, "page.card_seen");
  await expect(mine).toContainText(name);
  // Only the work she chose, as chips, and her rate in its unit (ADR 0053 §7).
  await expect(mine.getByRole("list", { name: say("card.what") }).getByRole("listitem")).toHaveText(["Cook"]);
  await expect(mine).toContainText("Jayanagar");
  await expect(mine).toContainText(say("price.per", { price: "₹11,000", unit: say("unit.month") }));
  await expect(mine).not.toContainText(say("find.from", { price: "₹11,000" }));
  await expect(mine).toContainText(ABOUT);
  // GigSync's record of her jobs: jobs done, and the average of 5, 4, 5, 5 to one decimal, over four ratings.
  await expect(stats(mine)).toHaveText(["5", "★ 4.8"]);
  await expect(mine.getByRole("term").first()).toHaveText(say("record.card_jobs"));
  await expect(mine).not.toContainText("Came back");
  await expect(mine).toContainText(plural(en, "record.card_rated", 4));
  await expect(mine.getByRole("img", { name: say("qr.alt", { name }) })).toBeVisible();
  await expect(mine).toContainText(say("qr.about_worker", { name: "Lakshmi" }));
  for (const key of ["qr.share", "qr.copy", "qr.scan"] as const)
    await expect(mine.getByRole("button", { name: say(key), exact: true })).toBeVisible();
  // No "Make a new QR": the QR carries a code, and whoever scans it sees the card as it is now.
  await expect(mine.getByRole("button", { name: /new QR/i })).toHaveCount(0);
  await expect(mine.getByRole("link", { name: say("qr.download") })).toBeVisible();
  await expect(page.getByRole("button", { name: say("shell.edit_card"), exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: say("card.change_by_talking"), exact: true })).toHaveCount(1);
  await shots(page, "worker-record");

  // Privacy: the record off. The card goes to the board again saying so, and My card says households do not see it.
  const hidden = published(page, (sent) => sent.show_record === false);
  await open(page, "nav.privacy");
  await page.getByRole("switch", { name: say("record.setting") }).uncheck();
  const sent = await hidden;
  expect(sent.record).toBeUndefined();
  await open(page, "nav.card");
  await expect(mine).toContainText(say("record.card_hidden"));
});

test("a new worker's record is zeros and not yet rated, and Edit my card opens the form", async ({ browser }) => {
  const page = await phone(browser);
  await cook(page, `Mohan ${RUN}`);
  await open(page, "nav.card");
  const mine = card(page, "page.card_seen");
  await expect(stats(mine)).toHaveText(["0", say("record.card_no_stars")]);
  await expect(mine).toContainText(say("record.card_not_rated"));
  await shots(page, "worker-new");
  await page.getByRole("button", { name: say("shell.edit_card"), exact: true }).click();
  await expect(page.getByRole("form", { name: say("a11y.my_card") })).toBeVisible();
});

test("a household's My card: first name, Household, the QR and its buttons, and no record", async ({ browser }) => {
  const page = await phone(browser);
  const name = `Rekha ${RUN}`;
  await signIn(page, { role: Role.consumer, name, phone: newPhone(), address: "HSR Layout" });
  // A share sheet that records what it was given, as a phone's would open.
  await page.evaluate(() => {
    const shared: unknown[] = [];
    Object.assign(window, { sharedLinks: shared });
    Object.defineProperty(navigator, "share", { value: async (data: unknown) => void shared.push(data) });
    Object.defineProperty(navigator, "canShare", { value: () => true });
  });
  await open(page, "nav.card");
  const mine = card(page, "qr.mine");
  await expect(mine).toContainText("Rekha");
  await expect(mine).toContainText(say("qr.household"));
  await expect(mine).toContainText(say("qr.about_household"));
  await expect(stats(mine)).toHaveCount(0);
  await expect(page.getByRole("button", { name: say("shell.edit_card"), exact: true })).toHaveCount(0);
  await expect(mine.getByRole("img", { name: say("qr.alt", { name }) })).toBeVisible();
  await shots(page, "household");
  await mine.getByRole("button", { name: say("qr.share"), exact: true }).click();
  await expect(mine.getByRole("status")).toHaveText(say("qr.shared"));
  const shared = await page.evaluate(() => (window as unknown as { sharedLinks: { url: string }[] }).sharedLinks);
  expect(shared[0]?.url).toMatch(/\?to=/);
});

test("Share copies the link where the phone has no share sheet", async ({ browser }) => {
  const page = await phone(browser);
  await signIn(page, { role: Role.consumer, name: `Usha ${RUN}`, phone: newPhone(), address: "HSR Layout" });
  await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined }));
  await open(page, "nav.card");
  const mine = card(page, "qr.mine");
  await mine.getByRole("button", { name: say("qr.share"), exact: true }).click();
  await expect(mine.getByRole("status").filter({ hasText: /Link copied|did not allow copying/ })).toBeVisible();
});

test("a household scanning a worker sees the record GigSync keeps, and none once she hides it", async ({ browser }) => {
  const [worker, household] = [await phone(browser), await phone(browser)];
  const name = `Kavya ${RUN}`;
  const number = newPhone();
  await seedServedJobs(number, RATED);
  // Seeding signed the number in on another device, so the move prompt comes; this cook is not moving.
  await cook(worker, name, number, MovePrompt.notNow);
  const code = worker.waitForResponse((r) => r.url() === MY_QR && r.request().method() === HttpMethod.put && r.ok());
  await open(worker, "nav.card");
  const qr: QrCode = MyQr.parse(await (await code).json()).code;
  // Nothing about a record goes to the board with her card: the server computes it.
  await expect(stats(card(worker, "page.card_seen"))).toHaveText(["5", "★ 4.8"]);

  await signIn(household, { role: Role.consumer, name: `Asha ${RUN}`, phone: newPhone(), address: "Jayanagar" });
  await household.goto(`${APP}/?to=${qr}`);
  const seen = household.getByRole("region", { name: "Kavya" });
  await expect(seen).toContainText(ABOUT);
  await expect(stats(seen)).toHaveText([plural(en, "record.jobs_done", 5), "★ 4.8"]);

  const hidden = published(worker, (sent) => sent.show_record === false);
  await open(worker, "nav.privacy");
  await worker.getByRole("switch", { name: say("record.setting") }).uncheck();
  await hidden;
  await household.goto(`${APP}/?to=${qr}`);
  await expect(household.getByRole("region", { name: "Kavya" })).toContainText(ABOUT);
  await expect(stats(household.getByRole("region", { name: "Kavya" }))).toHaveCount(0);
});

test("Change by talking opens the chat on the card, asking what to change", async ({ browser }) => {
  const page = await phone(browser);
  await cook(page, `Meena ${RUN}`, newPhone());
  await open(page, "nav.card");
  await page.getByRole("button", { name: say("card.change_by_talking"), exact: true }).click();
  await expect(page.getByRole("log")).toContainText(say("iv.what_change"));
});
