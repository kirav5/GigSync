import { bookingText, localNow, type MessageKey, type Params, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { drawer, escapeRe, newPhone, open, openDrawer, Role, RUN, signIn } from "./helpers.js";
import { nextTurn, type } from "./talk.js";

/**
 * A worker's own schedule (ADR 0048), through the real screens: a booking said in Talk is kept on the phone and read
 * back with its day and hours, listed when asked, shown on Activity with Delete, and cancelled by chat or by Delete.
 * Routing here is the word lists (no understanding pack in the test browser), the fallback every phone has.
 */

const { en } = Lang.enum;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
/** India's offset, which the test browser uses too, so "tomorrow" means the same day on both sides. */
const IST_MINUTES = 330;
const TODAY = localNow(new Date(), IST_MINUTES).day;
const MS_PER_DAY = 86_400_000;
const ISO_DAY_LENGTH = 10;
const TOMORROW = new Date(Date.parse(TODAY) + MS_PER_DAY).toISOString().slice(0, ISO_DAY_LENGTH);
/** A line as the app writes it; engines' locale data differ only in "pm" against "PM". */
const whole = (text: string) => new RegExp(`^${escapeRe(text)}$`, "i");
const TWO_TO_THREE = bookingText(en, { day: TOMORROW, start_min: 840, end_min: 900 }, TODAY);
const FOUR_TO_FIVE = bookingText(en, { day: TOMORROW, start_min: 960, end_min: 1020 }, TODAY);
const PLACE = "Sharma ji's house";

test.use({ timezoneId: "Asia/Kolkata" });

const talkLog = (page: Page) => page.getByRole("log");
const bookings = (page: Page) => page.getByRole("region", { name: say("schedule.title") });

/** An empty chat beside the card interview, which a worker without a card opens on. */
async function newChat(page: Page) {
  await openDrawer(page);
  await drawer(page)
    .getByRole("button", { name: say("chats.new"), exact: true })
    .click();
  await expect(page.getByText(say("agent.empty"))).toBeVisible();
}

test("a booking said in Talk is kept, listed, shown on Activity and cancelled", async ({ page }) => {
  await signIn(page, { role: Role.worker, name: `Lata ${RUN}`, phone: newPhone(), lang: en });
  await expect(page.getByText(say("iv.ask.trade"))).toBeVisible();
  await newChat(page);

  await test.step("saving reads the day, the hours and the place back", async () => {
    await nextTurn(page, en, "schedule.saved", () => type(page, en, `save my booking for tomorrow 2-3PM at ${PLACE}`));
    await expect(talkLog(page).getByText(whole(TWO_TO_THREE))).toBeVisible();
    await expect(talkLog(page).getByText(PLACE, { exact: true })).toBeVisible();
  });

  await test.step("asking lists it, and a day with nothing says so", async () => {
    await nextTurn(page, en, "schedule.list", () => type(page, en, "what's on my schedule tomorrow?"));
    await expect(talkLog(page).getByText(whole(TWO_TO_THREE))).toHaveCount(2);
    await nextTurn(page, en, "schedule.free_day", () => type(page, en, "what is on my schedule today?"));
  });

  await test.step("Jobs shows it with Delete", async () => {
    await open(page, "nav.jobs", en);
    await expect(bookings(page).getByText(whole(TWO_TO_THREE))).toBeVisible();
    await expect(
      bookings(page).getByRole("button", { name: whole(say("schedule.delete_named", { when: TWO_TO_THREE })) }),
    ).toBeVisible();
  });

  await test.step("cancelling by chat takes it off", async () => {
    await open(page, "nav.talk", en);
    await nextTurn(page, en, "schedule.cancelled", () => type(page, en, "cancel my booking tomorrow 2pm"));
    await open(page, "nav.jobs", en);
    await expect(bookings(page)).toHaveCount(0);
  });

  await test.step("Delete on Jobs takes one said in Hinglish off", async () => {
    await open(page, "nav.talk", en);
    await nextTurn(page, en, "schedule.saved", () => type(page, en, "kal 4 se 5 baje booking hai"));
    await expect(talkLog(page).getByText(whole(FOUR_TO_FIVE))).toBeVisible();
    await open(page, "nav.jobs", en);
    await bookings(page)
      .getByRole("button", { name: whole(say("schedule.delete_named", { when: FOUR_TO_FIVE })) })
      .click();
    await expect(bookings(page)).toHaveCount(0);
  });
});
