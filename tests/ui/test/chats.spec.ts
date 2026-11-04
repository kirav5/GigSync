import { chatTitle, type MessageKey, type Params, plural, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { skipPriceQuestions } from "./findChat.js";
import {
  completeSignIn,
  drawer,
  listWorker,
  newPhone,
  onScreen,
  open,
  openDrawer,
  Role,
  RUN,
  reveal,
  shoot,
  signIn,
  signOutHere,
  textOf,
  toChat,
} from "./helpers.js";
import { nextTurn, type } from "./talk.js";

/**
 * Talk's chats, kept on the phone and listed in the menu like the collab app's sessions: "New chat" keeps the open chat
 * in the list and starts an empty one; a past chat opens with its turns and carries on, the unfinished card interview with it; chats survive a
 * reload; Delete removes one after a confirm; another owner on the same phone sees none of them. A household's Find
 * chats are kept the same way: a need sent to workers stays in its chat to read, and an unsent one carries on.
 */

const { en } = Lang.enum;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const FOLDER = "chats";
/** One-visit work, so the card goes straight on to the area (ADR 0051). */
const TRADE = "plumber";
const EARNED = say("agent.suggest_earned");
const EARNINGS = say("agent.earnings", { week: "₹0", month: "₹0", waiting: "₹0" });

const talkLog = (page: Page) => page.getByRole("log");
const chatList = (page: Page) => drawer(page).getByRole("region", { name: say("chats.title") });
/** A chat's row in the list, found by its title. */
const row = (page: Page, title: string) => chatList(page).getByRole("listitem").filter({ hasText: title });

async function showChats(page: Page) {
  await openDrawer(page);
  await expect(chatList(page)).toBeVisible();
}

test("chats are kept: a new chat keeps the last, a past one reopens and carries on, delete asks first", async ({
  page,
}) => {
  const asha = { role: Role.worker, name: `Asha ${RUN}`, phone: newPhone(), lang: en };
  await signIn(page, asha);
  await expect(page.getByText(textOf(en, "iv.ask.trade"))).toBeVisible();
  await nextTurn(page, en, "iv.ask.area", () => type(page, en, TRADE));

  await test.step("New chat opens an empty chat with the suggestions; the card waits in the first", async () => {
    await openDrawer(page);
    await drawer(page)
      .getByRole("button", { name: say("chats.new"), exact: true })
      .click();
    await expect(page.getByText(say("agent.empty"))).toBeVisible();
    await expect(page.getByText(textOf(en, "iv.ask.area"))).toHaveCount(0);
    await page.getByRole("button", { name: EARNED, exact: true }).click();
    await expect(talkLog(page).getByText(EARNINGS)).toBeVisible();
  });

  await test.step("the menu lists both under Today, newest first, each titled by its first words", async () => {
    await showChats(page);
    await expect(chatList(page)).toContainText(say("chats.today"));
    await expect(chatList(page).getByRole("listitem")).toHaveCount(2);
    await expect(chatList(page).getByRole("listitem").first()).toContainText(EARNED);
    await expect(row(page, TRADE)).toContainText(say("chats.card_waiting"));
    await shoot("list", { phone: page }, FOLDER);
  });

  await test.step("the first chat opens with its turns, and its card carries on from there", async () => {
    await row(page, TRADE)
      .getByRole("button", { name: new RegExp(`^${TRADE}`) })
      .click();
    await expect(chatList(page)).toHaveCount(0);
    await expect(talkLog(page).getByText(TRADE, { exact: true })).toBeVisible();
    await expect(talkLog(page).getByText(EARNINGS)).toHaveCount(0);
    await page.getByRole("button", { name: say("iv.resume") }).click();
    await nextTurn(page, en, "iv.ask.rate_visit", () => type(page, en, "Koramangala"));
  });

  await test.step("after a reload, both chats are there and the card is where it was", async () => {
    await page.reload();
    await expect(talkLog(page).getByText(TRADE, { exact: true })).toBeVisible();
    await expect(page.getByText(textOf(en, "iv.ask.rate_visit"))).toHaveCount(1);
    await showChats(page);
    await expect(chatList(page).getByRole("listitem")).toHaveCount(2);
  });

  await test.step("Delete asks first; Keep it keeps the chat, Delete removes it, also after a reload", async () => {
    const remove = () => row(page, EARNED).getByRole("button", { name: say("chats.delete_label", { title: EARNED }) });
    const confirm = page.getByRole("dialog", { name: say("chats.delete_label", { title: EARNED }) });
    await remove().click();
    await expect(confirm).toContainText(say("chats.delete_confirm"));
    await confirm.getByRole("button", { name: say("chats.keep") }).click();
    await expect(row(page, EARNED)).toHaveCount(1);
    await remove().click();
    await confirm.getByRole("button", { name: say("chats.delete_yes") }).click();
    await expect(row(page, EARNED)).toHaveCount(0);
    await page.reload();
    await showChats(page);
    await expect(row(page, TRADE)).toHaveCount(1);
    await expect(row(page, EARNED)).toHaveCount(0);
  });

  await test.step("another owner on the phone sees none of it; the first gets it back on signing in", async () => {
    await signOutHere(page);
    await completeSignIn(page, { role: Role.worker, name: `Geeta ${RUN}`, phone: newPhone(), lang: en });
    await expect(page.getByText(textOf(en, "iv.ask.trade"))).toHaveCount(1);
    await expect(talkLog(page).getByText(TRADE, { exact: true })).toHaveCount(0);
    await showChats(page);
    await expect(row(page, TRADE)).toHaveCount(0);
    await signOutHere(page);
    await completeSignIn(page, asha);
    await expect(talkLog(page).getByText(TRADE, { exact: true })).toBeVisible();
    await expect(page.getByText(textOf(en, "iv.ask.rate_visit"))).toHaveCount(1);
  });
});

const HSR = { lat: 12.9116, lon: 77.6474 };
const RATE_PAISE = 65_000;
const FAN = "Bedroom fan not working, need an electrician tomorrow morning, up to 700";
/** What the worker reads of the fan need: the household's words without the budget. */
const FAN_WORDS = "Bedroom fan not working, need an electrician tomorrow morning";
/** How the fan chat's title starts, to find its row; and the whole title, cut short, which Delete names. */
const FAN_START = "Bedroom fan";
const FAN_TITLE = chatTitle(FAN) ?? FAN;
const TAP = "Kitchen tap leaking, need a plumber";
const NEW_NEED = say("chats.new_need");

const needBox = (page: Page) => page.getByRole("form", { name: say("need.composer") });
const found = (page: Page) => page.getByRole("group", { name: say("a11y.ask_workers") });

/** Types into Find's chat and sends it. */
async function tell(page: Page, words: string) {
  await needBox(page).getByRole("textbox").fill(words);
  await needBox(page)
    .getByRole("button", { name: say("a11y.send") })
    .click();
}

/** On a sent chat, "Ask for something else": a new chat opens on the first question, the sent one left as it was. */
async function startAgain(page: Page) {
  await expect(talkLog(page)).toContainText(say("need.asked"));
  await page.getByRole("button", { name: NEW_NEED }).click();
  await expect(talkLog(page)).toContainText(say("need.start"));
  await expect(talkLog(page)).not.toContainText(FAN);
}

/** Opens a chat from the menu by the start of its title. */
async function reopen(page: Page, start: string) {
  await showChats(page);
  await row(page, start)
    .getByRole("button", { name: new RegExp(`^${start}`) })
    .click();
  await expect(chatList(page)).toHaveCount(0);
}

test("a household's Find chats are kept: a sent need stays to read, new chats keep the old, delete asks first", async ({
  page,
}) => {
  const worker = `Ravi ${RUN}`;
  const listed = await listWorker(worker, ["electrician"], HSR, RATE_PAISE, {
    area_name: "HSR Layout",
    languages: [en],
  });
  const meena = { role: Role.consumer, name: `Meena ${RUN}`, phone: newPhone(), address: "Flat 4, HSR", lang: en };
  try {
    await signIn(page, meena);
    await expect(talkLog(page)).toContainText(say("need.start"));

    await test.step("a need sent to workers stays in the menu; back on Find, the next need starts afresh", async () => {
      await tell(page, FAN);
      await expect(talkLog(page)).toContainText(say("need.ask.address"));
      await tell(page, "HSR");
      await skipPriceQuestions({ page, lang: en });
      await talkLog(page)
        .getByRole("button", { name: say("flag.yes"), exact: true })
        .click();
      await expect(found(page).getByLabel(say("a11y.worker", { name: worker }))).toBeVisible();
      for (const box of await found(page).getByRole("checkbox", { checked: true }).all()) await box.uncheck();
      await found(page)
        .getByRole("checkbox", { name: say("a11y.ask_worker", { name: worker }) })
        .check();
      await found(page)
        .getByRole("button", { name: plural(en, "find.ask", 1) })
        .click();
      await onScreen(page, "nav.my_jobs");
      await toChat(page);
      await expect(talkLog(page)).toContainText(say("need.start"));
      await expect(talkLog(page)).not.toContainText(say("need.asked"));
      await showChats(page);
      await expect(chatList(page).getByRole("listitem")).toHaveCount(1);
      await expect(row(page, FAN_START)).not.toContainText(say("chats.need_unsent"));
    });

    await test.step("the next need is a chat of its own; the menu lists both by their first words", async () => {
      await reopen(page, FAN_START);
      await startAgain(page);
      await tell(page, TAP);
      await expect(talkLog(page).getByText(TAP, { exact: true })).toBeVisible();
      await showChats(page);
      await expect(chatList(page).getByRole("listitem")).toHaveCount(2);
      await expect(chatList(page).getByRole("listitem").first()).toContainText(TAP);
      await expect(row(page, TAP)).toContainText(say("chats.need_unsent"));
      await shoot("household-list", { household: page }, FOLDER);
    });

    await test.step("New chat keeps the open one; an empty chat is not listed", async () => {
      await drawer(page)
        .getByRole("button", { name: say("chats.new"), exact: true })
        .click();
      await expect(talkLog(page)).toContainText(say("need.start"));
      await expect(talkLog(page)).not.toContainText(TAP);
      await showChats(page);
      await expect(chatList(page).getByRole("listitem")).toHaveCount(2);
    });

    await test.step("the sent chat reopens to read; the unsent one carries on where it was", async () => {
      await reopen(page, FAN_START);
      await expect(talkLog(page).getByText(FAN, { exact: true })).toBeVisible();
      await expect(talkLog(page)).toContainText(say("need.asked"));
      await expect(
        found(page).getByRole("checkbox", { name: say("a11y.ask_worker", { name: worker }) }),
      ).toBeDisabled();
      await expect(needBox(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: NEW_NEED })).toBeVisible();
      await shoot("household-sent", { household: page }, FOLDER);
      await reopen(page, TAP);
      await expect(talkLog(page).getByText(TAP, { exact: true })).toBeVisible();
      await expect(needBox(page)).toBeVisible();
      await expect(page.getByRole("button", { name: NEW_NEED })).toHaveCount(0);
    });

    await test.step("after a reload both are there, and the unsent need opens where it was", async () => {
      await page.reload();
      await expect(talkLog(page).getByText(TAP, { exact: true })).toBeVisible();
      await expect(needBox(page)).toBeVisible();
      await showChats(page);
      await expect(chatList(page).getByRole("listitem")).toHaveCount(2);
    });

    await test.step("Delete says the job stays in My jobs; the chat goes, also after a reload, the job stays", async () => {
      const label = say("chats.delete_label", { title: FAN_TITLE });
      const remove = () => row(page, FAN_START).getByRole("button", { name: label });
      const confirm = page.getByRole("dialog", { name: label });
      await remove().click();
      await expect(confirm).toContainText(say("chats.delete_confirm_sent"));
      await confirm.getByRole("button", { name: say("chats.keep") }).click();
      await expect(row(page, FAN_START)).toHaveCount(1);
      await remove().click();
      await confirm.getByRole("button", { name: say("chats.delete_yes") }).click();
      await expect(row(page, FAN_START)).toHaveCount(0);
      await page.reload();
      await showChats(page);
      await expect(row(page, TAP)).toHaveCount(1);
      await expect(row(page, FAN_START)).toHaveCount(0);
      await open(page, "nav.my_jobs");
      await reveal(page, page.getByRole("main").getByText(FAN_WORDS).first());
    });

    await test.step("another household on the phone sees none of it; the first gets it back", async () => {
      await signOutHere(page);
      const geeta = { role: Role.consumer, name: `Geeta ${RUN}`, phone: newPhone(), address: "HSR", lang: en };
      await completeSignIn(page, geeta);
      await expect(talkLog(page)).toContainText(say("need.start"));
      await expect(talkLog(page)).not.toContainText(TAP);
      await showChats(page);
      await expect(chatList(page)).toContainText(say("chats.empty"));
      await signOutHere(page);
      await completeSignIn(page, meena);
      await expect(talkLog(page).getByText(TAP, { exact: true })).toBeVisible();
    });
  } finally {
    await listed.removeProfile();
  }
});
