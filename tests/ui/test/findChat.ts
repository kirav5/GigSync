import { type MessageKey, t } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { expect, type Locator, type Page } from "@playwright/test";
import { fillAddressForm } from "./address.js";

/**
 * Driving Find's chat the way a household answers it: the need in their own words, then whatever the agent still
 * asks, tapped or typed, up to the yes at the readback. The chat is the only way a household asks (ADR 0035), so the
 * journeys that used to fill the form come through here.
 */

/** A phone in a journey, with the language its owner chose. */
interface Phone {
  page: Page;
  lang: Lang;
}

/** Find's When chips that write a day the test can predict ("Pick a date" needs a date input). */
export type WhenChip = "when.today" | "when.tomorrow" | "when.daily";

/** What the household answers, each only if the agent asks it. */
export interface NeedAnswers {
  /** A trade's key ("electrician"): tapped when the words did not name it. */
  trade?: string;
  /** A pilot area by its English name ("HSR Layout"). */
  area: string;
  /** How long the work is for, for maid and driver work (ADR 0046); monthly when not given. */
  arrangement?: "hourly" | "visit" | "weekly" | "monthly";
  /** The household's own words: the first thing said. */
  need: string;
  when: WhenChip;
  /** The hour's chip as the owner reads it ("2 pm"); any time when not given. */
  hour?: string;
  /** Said at the readback, when given: the chat reads it into the need's time. */
  time?: string;
  /** The answer to the trade's first question; skipped when not given. */
  detail?: string;
  budget: string;
}

/** A turn's worth of waiting for the agent before the chat counts as stuck. */
const TURNS_MAX = 20;
const LAST = -1;

const log = (page: Page) => page.getByRole("log");
const chip = (page: Page, label: string) => log(page).getByRole("button", { name: label, exact: true });
/** The agent's newest turn: a question, or the readback. */
const newest = (page: Page) => log(page).locator(".msg-agent").nth(LAST);
/** Each agent turn has one replay button: their count says the agent has spoken again. */
const agentTurns = (page: Page, lang: Lang) =>
  log(page).getByRole("button", { name: t(lang, "speech.replay"), exact: true });

/** "HSR Layout" as its `area.*` key names it ("hsr_layout"). */
const areaKey = (name: string) => `area.${name.toLowerCase().replaceAll(" ", "_")}` as MessageKey;

/** Types into Find's chat and sends it. */
export async function say({ page, lang }: Phone, words: string) {
  const box = page.getByRole("form", { name: t(lang, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(lang, "a11y.send") }).click();
}

/**
 * Answers the first price question (ADR 0041) with "I don't know", which ends them: the estimate assumes the rest. Every
 * trade asks at least one with no phone model, so the journeys that walk Find by hand take this step before the budget.
 */
export async function skipPriceQuestions({ page, lang }: Phone) {
  await chip(page, t(lang, "driver.dont_know")).last().click();
}

/** Stands in for a line's `{name}` while matching it: the rest of the line must be there as written. */
const BLANK = "\u0000";

/** Whether the newest agent turn says the line `key`, whatever name fills it. */
async function says(page: Page, lang: Lang, key: MessageKey): Promise<boolean> {
  const text = (await newest(page).textContent()) ?? "";
  return t(lang, key, { name: BLANK })
    .split(BLANK)
    .every((part) => text.includes(part));
}

/** Taps `target` if it is there, and says so. */
async function tapIf(target: Locator): Promise<boolean> {
  if (!(await target.isVisible())) return false;
  await target.click();
  return true;
}

/** Answers whatever the agent asks now; true at the readback, which the caller answers. */
async function answer(phone: Phone, ask: NeedAnswers): Promise<boolean> {
  const { page, lang } = phone;
  if ((await says(page, lang, "need.confirm")) || (await says(page, lang, "need.confirm_to"))) return true;
  if (await says(page, lang, "need.ask.budget")) return say(phone, ask.budget).then(() => false);
  // The hour, once the day is known (ADR 0050 §1): the journeys take any time unless they say one.
  if (await says(page, lang, "need.ask.hour"))
    return chip(page, ask.hour ?? t(lang, "when.any_time"))
      .click()
      .then(() => false);
  if (await says(page, lang, "need.ask.when"))
    return chip(page, t(lang, ask.when))
      .click()
      .then(() => false);
  if (ask.detail && (await chip(page, t(lang, "iv.skip")).isVisible())) return say(phone, ask.detail).then(() => false);
  const taps = [
    "memory.use",
    "terms.scope_ok",
    ...(ask.trade ? [`trade.${ask.trade}` as MessageKey] : []),
    `need.arr.${ask.arrangement ?? "monthly"}` as MessageKey,
    areaKey(ask.area),
    // A price question (ADR 0041): the journeys leave it to the estimate to assume.
    "driver.dont_know",
    "iv.skip",
    "flag.no",
  ] as const satisfies readonly MessageKey[];
  // A saved address in the area answers "where" (ADR 0045), so the worker gets it once both sign.
  const home = t(lang, "addr.chip", { label: t(lang, "addr.label.home"), area: ask.area });
  if ((await says(page, lang, "need.ask.address")) && (await tapIf(chip(page, home)))) return false;
  for (const key of taps) if (await tapIf(chip(page, t(lang, key)))) return false;
  // No saved address in the area: one is added from the chat, as a household must before workers are asked.
  if (await tapIf(chip(page, t(lang, "addr.add")))) {
    await fillAddressForm(page, lang, { house: "House 12, 3rd Cross", area: ask.area });
    return false;
  }
  throw new Error(`Find's chat asked something the test cannot answer: ${await newest(page).textContent()}`);
}

/**
 * Says the need, answers what the agent asks, and at the readback says the time (if any) and taps yes: the search
 * starts, or a chat addressed to one worker sends to them.
 */
export async function tellNeed(phone: Phone, ask: NeedAnswers) {
  const { page, lang } = phone;
  await expect(newest(page)).toBeVisible();
  let before = await agentTurns(page, lang).count();
  await say(phone, ask.need);
  let timeSaid = !ask.time;
  for (let turn = 0; turn < TURNS_MAX; turn++) {
    // The agent has answered the last thing said: its newest turn is the one to answer.
    await expect(agentTurns(page, lang)).not.toHaveCount(before);
    before = await agentTurns(page, lang).count();
    const readback = await answer(phone, ask);
    if (readback && timeSaid) return chip(page, t(lang, "flag.yes")).click();
    if (readback && ask.time) {
      timeSaid = true;
      await say(phone, ask.time);
    }
  }
  throw new Error("Find's chat never reached the readback");
}

/** The workers a search found, to pick from. */
export const foundWorkers = (page: Page, lang: Lang) => page.getByRole("group", { name: t(lang, "a11y.ask_workers") });

/** Ticks only `worker` among the workers found; the caller presses Ask. */
export async function pickOnly({ page, lang }: Phone, worker: string) {
  const found = foundWorkers(page, lang);
  await expect(found.getByLabel(t(lang, "a11y.worker", { name: worker }))).toBeVisible();
  for (const box of await found.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await found.getByRole("checkbox", { name: t(lang, "a11y.ask_worker", { name: worker }) }).check();
}
