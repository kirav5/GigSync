import { t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { expect, type Page } from "@playwright/test";

/** What a test does with the notice about job records (ADR 0038 §5) after signing in. */
export const NoticeAnswer = { agree: "agree", later: "later", leave: "leave" } as const;
export type NoticeAnswer = (typeof NoticeAnswer)[keyof typeof NoticeAnswer];

/** The owner's stored answer, under any owner: the app writes it as `...owner_settings...:records_consent`. */
const ANSWER_KEY = /owner_settings.*:records_consent$/;
const NOTICE_MS = 60_000;

/** Where the phone stands right after sign-in: the notice is up, the owner answered it before, or neither yet. */
async function noticeState(page: Page, lang: Lang): Promise<"notice" | "answered" | "waiting"> {
  if (await page.getByRole("button", { name: t(lang, "records.agree"), exact: true }).isVisible()) return "notice";
  const answered = await page.evaluate(
    (pattern) => Object.keys(localStorage).some((k) => new RegExp(pattern).test(k)),
    ANSWER_KEY.source,
  );
  return answered ? "answered" : "waiting";
}

/**
 * After signing in: a new owner sees the notice (the server has no answer for a new number) and answers it as asked;
 * an owner who answered on this phone before does not. "leave" keeps the notice up for the test to look at.
 */
export async function answerNotice(page: Page, lang: Lang, answer: NoticeAnswer = NoticeAnswer.agree) {
  if (answer === NoticeAnswer.leave) return;
  await expect.poll(() => noticeState(page, lang), { timeout: NOTICE_MS }).not.toBe("waiting");
  if ((await noticeState(page, lang)) !== "notice") return;
  const key = answer === NoticeAnswer.agree ? "records.agree" : "records.not_now";
  await page.getByRole("button", { name: t(lang, key), exact: true }).click();
  await expect(page.getByRole("button", { name: t(lang, "records.agree"), exact: true })).toHaveCount(0);
}
