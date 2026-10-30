import { type MessageKey, type Params, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";
import { completeSignIn, newPhone, open, Role, RUN, shoot, signIn, textOf } from "./helpers.js";
import { nextTurn, type } from "./talk.js";

/**
 * Talk's chats, kept on the phone like the collab app's sessions: "New chat" keeps the open chat in Chats and starts an
 * empty one; a past chat opens with its turns and carries on, the unfinished card interview with it; chats survive a
 * reload; Delete removes one after a confirm; another owner on the same phone sees none of them.
 */

const { en } = Lang.enum;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const FOLDER = "chats";
const TRADE = "cook";
const EARNED = say("agent.suggest_earned");
const EARNINGS = say("agent.earnings", { week: "₹0", month: "₹0", waiting: "₹0" });

const talkLog = (page: Page) => page.getByRole("log");
const chatList = (page: Page) => page.getByRole("region", { name: say("chats.title") });
const chatsButton = (page: Page) => page.getByRole("button", { name: say("chats.open"), exact: true });
/** A chat's row in the list, found by its title. */
const row = (page: Page, title: string) => chatList(page).getByRole("listitem").filter({ hasText: title });

async function showChats(page: Page) {
  await chatsButton(page).click();
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
    await page.getByRole("button", { name: say("chats.new"), exact: true }).click();
    await expect(page.getByText(say("agent.empty"))).toBeVisible();
    await expect(page.getByText(textOf(en, "iv.ask.area"))).toHaveCount(0);
    await page.getByRole("button", { name: EARNED, exact: true }).click();
    await expect(talkLog(page).getByText(EARNINGS)).toBeVisible();
  });

  await test.step("Chats lists both under Today, newest first, each titled by its first words", async () => {
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
    await nextTurn(page, en, "iv.ask.rate_month", () => type(page, en, "Koramangala"));
  });

  await test.step("after a reload, both chats are there and the card is where it was", async () => {
    await page.reload();
    await expect(talkLog(page).getByText(TRADE, { exact: true })).toBeVisible();
    await expect(page.getByText(textOf(en, "iv.ask.rate_month"))).toHaveCount(1);
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
    await open(page, "nav.profile");
    await page.getByRole("button", { name: say("shell.sign_out") }).click();
    await completeSignIn(page, { role: Role.worker, name: `Geeta ${RUN}`, phone: newPhone(), lang: en });
    await expect(page.getByText(textOf(en, "iv.ask.trade"))).toHaveCount(1);
    await expect(talkLog(page).getByText(TRADE, { exact: true })).toHaveCount(0);
    await showChats(page);
    await expect(row(page, TRADE)).toHaveCount(0);
    await open(page, "nav.profile");
    await page.getByRole("button", { name: say("shell.sign_out") }).click();
    await completeSignIn(page, asha);
    await expect(talkLog(page).getByText(TRADE, { exact: true })).toBeVisible();
    await expect(page.getByText(textOf(en, "iv.ask.rate_month"))).toHaveCount(1);
  });
});
