import { HttpMethod, hourText, t } from "@gigsync/core";
import { BoardProfile, type GeoResult, Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { API, newPhone, open, Role, RUN, signIn } from "./helpers.js";
import { publishCard, unlistCards } from "./journey.js";
import { putOnBoard, type, unlist } from "./talk.js";

/**
 * Changing the card in the chat (ADR 0053 §7): each change is a tap or a sentence, and it reaches the board only after
 * the owner says yes to the summary. Taking the card off is asked once more before it happens.
 */

const en = Lang.enum.en;
const BOARD_PROFILE = `${API}/v1/board/profile`;
const NINE = 9;
const SIX_PM = 18;
const WORK_DAYS = [1, 2, 3, 4, 5, 6];
const FAR_KM = 5;

/** Banashankari 2nd Stage, outside the pilot areas: only the phone's location can name it. */
const HERE = { latitude: 12.925311, longitude: 77.546722 };
const COARSE = { lat: 12.93, lon: 77.55 };
const LOCALITY = "Banashankari 2nd Stage";
const FOUND: GeoResult = {
  places: [{ label: `${LOCALITY}, Bengaluru`, locality: LOCALITY, city: "Bengaluru", pin: "560070", point: COARSE }],
};

test.afterEach(unlistCards);

const chip = (page: Page, name: string) => page.getByRole("log").getByRole("button", { name, exact: true }).last();
const log = (page: Page) => page.getByRole("log");

async function carpenter(page: Page, name: string) {
  await signIn(page, { role: Role.worker, name, phone: newPhone() });
  await publishCard({ page, lang: en }, { trade: "Carpenter", area: "jayanagar", rate: "900", min: "700", about: "" });
  await open(page, "nav.card");
  await page.getByRole("button", { name: t(en, "card.change_by_talking"), exact: true }).click();
  await expect(log(page)).toContainText(t(en, "iv.what_change"));
}

test("a worker sets their hours, days and how far they go in the chat, and the board gets them", async ({ page }) => {
  await carpenter(page, `Ramesh ${RUN}`);
  await chip(page, t(en, "terms.card_clock")).click();
  await chip(page, t(en, "when.hour", { time: hourText(en, NINE) })).click();
  await expect(log(page)).toContainText(t(en, "iv.ask.hours_to", { from: hourText(en, NINE) }));
  await chip(page, t(en, "when.hour", { time: hourText(en, SIX_PM) })).click();
  await expect(log(page)).toContainText(
    t(en, "iv.summary_hours", { from: hourText(en, NINE), to: hourText(en, SIX_PM) }),
  );

  // A sentence with the value in it answers at once, and comes back to the summary.
  await type(page, en, "change my days to Monday to Saturday");
  await expect(log(page)).toContainText(t(en, "iv.summary_days", { days: "Mon, Tue, Wed, Thu, Fri, Sat" }));
  await type(page, en, "change how far I go to 5 km");
  await expect(log(page)).toContainText(t(en, "iv.summary_radius", { km: FAR_KM }));

  const sent = page.waitForResponse(
    (r) => r.url() === BOARD_PROFILE && r.request().method() === HttpMethod.put && r.ok(),
  );
  await putOnBoard(page, en).click();
  const card = BoardProfile.parse((await sent).request().postDataJSON());
  expect(card.work_hours).toMatchObject({ days: WORK_DAYS, from: NINE, to: SIX_PM });

  // What the agent will use stays too: the form shows the same choices.
  await open(page, "nav.card");
  await page.getByRole("button", { name: t(en, "shell.edit_card"), exact: true }).click();
  const form = page.getByRole("form", { name: t(en, "a11y.my_card") });
  await expect(form.getByLabel(t(en, "terms.card_from"))).toHaveValue(String(NINE));
  await expect(form.getByRole("button", { name: t(en, "card.km", { km: FAR_KM }), exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("a worker takes their card off the board in the chat, after saying yes once more", async ({ page }) => {
  await carpenter(page, `Suresh ${RUN}`);
  await chip(page, t(en, "card.unlist")).click();
  await expect(log(page)).toContainText(t(en, "iv.ask.unlist"));
  await chip(page, t(en, "flag.no")).click();
  await expect(log(page)).toContainText(t(en, "iv.confirm"));

  await type(page, en, "take my card off the board");
  await chip(page, t(en, "flag.yes")).click();
  await expect(log(page)).toContainText(t(en, "card.off_board"));
  await open(page, "nav.card");
  await expect(page.getByText(t(en, "profile.card_off"))).toBeVisible();
});

test("a card off the board opens on putting it back", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Girish ${RUN}`, phone: newPhone() });
  await publishCard({ page, lang: en }, { trade: "Carpenter", area: "jayanagar", rate: "900", min: "700", about: "" });
  await unlist(page, en);
  await page.getByRole("button", { name: t(en, "card.change_by_talking"), exact: true }).click();
  await expect(log(page)).toContainText(t(en, "iv.confirm"));
});

test("a worker outside the pilot areas sets their area from the phone's location in the chat", async ({ browser }) => {
  const context = await browser.newContext({ geolocation: HERE, permissions: ["geolocation"] });
  const page = await context.newPage();
  await page.route(`${API}/v1/geo/reverse**`, (route) => route.fulfill({ json: FOUND }));
  await carpenter(page, `Naveen ${RUN}`);
  await chip(page, t(en, "card.where")).click();
  await chip(page, t(en, "card.use_location")).click();
  await page.getByRole("button", { name: t(en, "addr.allow"), exact: true }).click();
  await expect(log(page)).toContainText(LOCALITY);
  const sent = page.waitForResponse(
    (r) => r.url() === BOARD_PROFILE && r.request().method() === HttpMethod.put && r.ok(),
  );
  await putOnBoard(page, en).click();
  const card = BoardProfile.parse((await sent).request().postDataJSON());
  expect(card.area_name).toBe(LOCALITY);
  expect(card.area).toEqual(COARSE);
  await expect(log(page)).toContainText(LOCALITY);
  await unlistCards();
  await context.close();
});
