import { plural, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, shoot, signIn } from "./helpers.js";
import { fillAsk, type Phone, publishCard, unlistCards } from "./journey.js";

/**
 * Photos of the job (ADR 0066), through the real screens and API: a household adds a photo from the composer's "+",
 * sees it as a tile it can take off, asks a carpenter, and the carpenter's phone shows the same photo on the request.
 * The photo is shrunk on her phone and travels inside the encrypted request; the server keeps none.
 */

const { en } = Lang.enum;
const FOLDER = "photos";
const say = (key: Parameters<typeof t>[1], params?: Parameters<typeof t>[2]) => t(en, key, params);
/** A small real picture: a 16×16 PNG, as a phone's gallery might hand over (it is turned into a JPEG). */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAFklEQVR4nGNYEqhNEmIY1TCqYfhqAACV5yAQVIDWlQAAAABJRU5ErkJggg==",
  "base64",
);

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

/** Adds the picture through the composer's "+" and the phone's file chooser. */
async function addPhoto(page: Page) {
  await page.getByRole("button", { name: say("composer.more"), exact: true }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: say("photo.add"), exact: true }).click();
  await (await chooser).setFiles({ name: "door.png", mimeType: "image/png", buffer: PNG });
}

test("a household adds a photo of the job, and the carpenter sees it on the request", async ({ browser }) => {
  contexts = [await browser.newContext(), await browser.newContext()];
  const [workerPage, homePage] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const worker: Phone = { page: workerPage, lang: en };
  const household: Phone = { page: homePage, lang: en };
  const names = { worker: `Imran photo ${RUN}`, household: `Kavya photo ${RUN}` };
  await signIn(workerPage, { role: Role.worker, name: names.worker, phone: newPhone() });
  await publishCard(worker, {
    trade: t(en, "trade.carpenter"),
    area: "jayanagar",
    rate: "800",
    min: "600",
    about: "Doors",
  });
  await open(workerPage, "nav.activity");
  await signIn(homePage, {
    role: Role.consumer,
    name: names.household,
    phone: newPhone(),
    address: "No. 4",
    area: "Jayanagar",
  });
  // A photo first, as someone shows the broken thing before saying much; then two, then one taken off.
  await open(homePage, "nav.home");
  await addPhoto(homePage);
  const tiles = homePage.getByRole("img", { name: /^Photo \d of the job$/ });
  await expect(tiles).toHaveCount(1);
  await addPhoto(homePage);
  await expect(tiles).toHaveCount(2);
  await homePage.getByRole("button", { name: say("photo.remove", { n: 2 }), exact: true }).click();
  await expect(tiles).toHaveCount(1);
  expect(await tiles.first().getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
  await fillAsk(household, {
    trade: "carpenter",
    area: "Jayanagar",
    worker: names.worker,
    need: "The cupboard door has come off",
    when: "when.tomorrow",
    budget: "750",
  });
  // The photo stays with the need through the chat.
  await expect(tiles).toHaveCount(1);
  await shoot("added", { household: homePage }, FOLDER);

  await homePage.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  // On his phone: the request carries the same photo, which opens full size (her words already said the problem).
  await open(workerPage, "nav.activity");
  const his = workerPage.getByRole("img", { name: say("photo.alt", { n: 1 }) }).first();
  await expect(his).toBeVisible({ timeout: 90_000 });
  expect(await his.getAttribute("src")).toMatch(/^data:image\/jpeg;base64,/);
  await his.click();
  await expect(workerPage.getByRole("dialog", { name: say("photo.alt", { n: 1 }) })).toBeVisible();
  await shoot("seen", { worker: workerPage, household: homePage }, FOLDER);
});
