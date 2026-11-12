import { type MessageKey, plural, t } from "@gigsync/core";
import { groupOf, isTradeKind, Lang, type WorkKind } from "@gigsync/protocol";
import { expect, type Locator, type Page } from "@playwright/test";
import { fillAddressForm } from "./address.js";
import { open, textOf } from "./helpers.js";
import type { KindPersona } from "./prod-kinds-data.js";
import { putOnBoard } from "./talk.js";

/**
 * The production run's two people (prod-kinds.spec.ts): a worker making their card in Talk and a household asking in
 * Find, each answering whatever the app asks next the way a person would, from their persona. Nothing is skipped to
 * make a test pass: a question the drivers cannot answer ends the kind and is reported with its words.
 */

const en = Lang.enum.en;
export const AREA = "HSR Layout";
const AREA_KEY = "area.hsr_layout";
const TURNS_MAX = 30;
/** How long one agent turn may take before the chat counts as stuck: a model call plus a sync or two. */
const TURN_MS = 60_000;

const chatLog = (page: Page) => page.getByRole("log");
const agentLines = (page: Page) => chatLog(page).locator(".msg-agent:not(.thinking)");
const chip = (page: Page, key: MessageKey) =>
  chatLog(page)
    .getByRole("button", { name: t(en, key), exact: true })
    .last();
const newest = (page: Page) => agentLines(page).last();
const says = async (page: Page, key: MessageKey) => textOf(en, key).test((await newest(page).innerText()) ?? "");
const kindKey = (kind: WorkKind): MessageKey =>
  (isTradeKind(kind) ? `trade.${kind}` : `category.${kind}`) as MessageKey;
/** The usual-rate question in each unit (ADR 0046). */
const RATE_ASKS: readonly MessageKey[] = [
  "iv.ask.rate_visit",
  "iv.ask.rate_month",
  "iv.ask.rate_hour",
  "iv.ask.rate_week",
];

async function saysAny(page: Page, keys: readonly MessageKey[]): Promise<boolean> {
  for (const key of keys) if (await says(page, key)) return true;
  return false;
}

async function tapIf(target: Locator): Promise<boolean> {
  if (!(await target.isVisible())) return false;
  await target.click();
  return true;
}

/** Waits for the agent to say something new after `act`, and returns how many lines it has said. */
async function afterTurn(page: Page, act: () => Promise<unknown>): Promise<void> {
  const before = await agentLines(page).count();
  await act();
  await expect(agentLines(page)).not.toHaveCount(before, { timeout: TURN_MS });
  await expect(chatLog(page).locator(".thinking")).toHaveCount(0, { timeout: TURN_MS });
}

async function typeTalk(page: Page, text: string) {
  await page
    .getByRole("form", { name: t(en, "nav.talk") })
    .getByRole("textbox")
    .fill(text);
  await page.getByRole("button", { name: t(en, "a11y.send"), exact: true }).click();
}

/** What the worker has said to the work question: their own words first, then, asked again, the work in a few words. */
interface CardSaid {
  work: number;
}

/** One step of the card interview: what the worker answers to the question now asked; "done" once published. */
async function cardStep(page: Page, p: KindPersona, said: CardSaid): Promise<"done" | "more"> {
  const tap = (key: MessageKey) => afterTurn(page, () => chip(page, key).click());
  const type = (text: string) => afterTurn(page, () => typeTalk(page, text));
  if (await says(page, "iv.published")) return "done";
  if (await says(page, "iv.confirm"))
    return afterTurn(page, () => putOnBoard(page, en).click()).then(() => "more" as const);
  if (await says(page, "skill.is_work")) await tap("flag.yes");
  else if (await says(page, "iv.ask.trade")) await type(said.work++ === 0 ? p.worker : t(en, kindKey(p.kind)));
  else if (await says(page, "iv.ask.also")) {
    if (p.also) await tapIf(chip(page, kindKey(p.also)));
    await tap("iv.done");
  } else if (await says(page, "iv.ask.arrangements")) {
    if (!(await tapIf(chip(page, `arrangement.${p.arrangement}` as MessageKey))))
      await chatLog(page)
        .getByRole("button")
        .filter({ hasNotText: t(en, "iv.done") })
        .first()
        .click();
    await tap("iv.done");
  } else if (await says(page, "iv.ask.area")) await tap(AREA_KEY as MessageKey);
  else if (await says(page, "iv.check_amount")) await tap("flag.yes");
  else if (await says(page, "iv.ask.min")) await type(String(p.min));
  else if (await says(page, "iv.ask.same_rate")) await tap(p.alsoRate ? "flag.no" : "flag.yes");
  else if (await says(page, "iv.ask.work_rate")) await type(String(p.alsoRate ?? p.rate));
  else if (await saysAny(page, RATE_ASKS)) await type(String(p.rate));
  else if (await says(page, "iv.ask.languages")) await tap("iv.none");
  else if (await says(page, "iv.ask.about")) await type(p.about);
  else if (await says(page, "iv.ask.ask_first")) await tap("flag.no");
  else if (await says(page, "iv.ask.asks")) await type(p.asks);
  else if (await says(page, "iv.ask.auto")) await tap("flag.yes");
  else throw new Error(`card interview asked something the worker cannot answer: ${await newest(page).innerText()}`);
  return "more";
}

/** The worker makes their card in Talk, answering every question, up to "your card is on the board". */
export async function buildCard(page: Page, p: KindPersona): Promise<void> {
  await expect(newest(page)).toBeVisible({ timeout: TURN_MS });
  const said: CardSaid = { work: 0 };
  for (let turn = 0; turn < TURNS_MAX; turn++) if ((await cardStep(page, p, said)) === "done") return;
  throw new Error("card interview never finished");
}

/** The first answer chip under an agent line, past its "hear it again" button; undefined when it offers none. */
async function firstChoice(line: Locator): Promise<Locator | undefined> {
  const replay = t(en, "speech.replay");
  for (const button of await line.getByRole("button").all()) {
    const name = (await button.getAttribute("aria-label")) ?? (await button.textContent()) ?? "";
    if (name !== replay && (await button.isEnabled())) return button;
  }
  return undefined;
}

async function sayFind(page: Page, words: string) {
  const box = page.getByRole("form", { name: t(en, "need.composer") });
  await box.getByRole("textbox").fill(words);
  await box.getByRole("button", { name: t(en, "a11y.send") }).click();
}

/** One step of Find's chat; true at the readback, which is answered yes. */
async function findStep(page: Page, p: KindPersona): Promise<boolean> {
  const tap = (target: Locator) => afterTurn(page, () => target.click());
  const type = (words: string) => afterTurn(page, () => sayFind(page, words));
  if ((await says(page, "need.confirm")) || (await says(page, "need.confirm_to"))) return true;
  if (await says(page, "need.ask.budget")) await type(String(p.budget));
  else if (await says(page, "need.ask.hour")) await tap(chip(page, "when.any_time"));
  else if (await says(page, "need.ask.when")) await tap(chip(page, "when.tomorrow"));
  else {
    const home = chatLog(page).getByRole("button", {
      name: t(en, "addr.chip", { label: t(en, "addr.label.home"), area: AREA }),
      exact: true,
    });
    const candidates: Locator[] = [
      home,
      chip(page, "memory.use"),
      chip(page, "terms.scope_ok"),
      chip(page, kindKey(p.kind)),
      chip(page, `group.${groupOf(p.kind)}` as MessageKey),
      chip(page, `need.arr.${p.arrangement}` as MessageKey),
      chip(page, AREA_KEY as MessageKey),
    ];
    for (const c of candidates) if (await c.isVisible()) return tap(c).then(() => false);
    if (await chip(page, "addr.add").isVisible()) {
      await chip(page, "addr.add").click();
      await afterTurn(page, () => fillAddressForm(page, en, { house: "House 12, 3rd Cross", area: AREA }));
    } else if (await chip(page, "iv.skip").isVisible()) await type(p.answer);
    else {
      // A question with choices only (a price question, a switch): the first choice, as a person in a hurry taps.
      const choice = await firstChoice(newest(page));
      if (choice) await tap(choice);
      else await type(p.answer);
    }
  }
  return false;
}

/** The household asks in Find, answering whatever it asks, and says yes at the readback. */
export async function askInFind(page: Page, p: KindPersona): Promise<void> {
  await expect(newest(page)).toBeVisible({ timeout: TURN_MS });
  await afterTurn(page, () => sayFind(page, p.need));
  for (let turn = 0; turn < TURNS_MAX; turn++) if (await findStep(page, p)) return chip(page, "flag.yes").click();
  throw new Error("Find's chat never reached the readback");
}

/** Asks only `worker` among those found; false when the search did not find them. */
export async function askWorker(page: Page, worker: string): Promise<boolean> {
  const found = page.getByRole("group", { name: t(en, "a11y.ask_workers") });
  await expect(found.or(page.getByText(textOf(en, "need.nobody")))).toBeVisible({ timeout: TURN_MS });
  const box = found.getByRole("checkbox", { name: t(en, "a11y.ask_worker", { name: worker }) });
  if (!(await box.isVisible())) return false;
  for (const other of await found.getByRole("checkbox", { checked: true }).all()) await other.uncheck();
  await box.check();
  await found.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  return true;
}

/** Answers the worker's agent's questions on the household's phone, in the household's words. */
async function answerQuestions(page: Page, p: KindPersona): Promise<string[]> {
  const form = page.getByRole("form", { name: t(en, "a11y.answer") });
  const asked = (await form.locator(".muted").allInnerTexts()).filter(Boolean);
  for (const yes of await form.getByRole("button", { name: t(en, "flag.yes"), exact: true }).all()) await yes.click();
  for (const box of await form.getByRole("textbox").all())
    await box.fill((await box.getAttribute("inputmode")) === "numeric" ? "2" : p.answer);
  for (const select of await form.getByRole("combobox").all()) await select.selectOption({ index: 0 });
  await form.getByRole("button", { name: t(en, "job.send_answers") }).click();
  return asked;
}

const signButton = (page: Page) => page.getByRole("button", { name: textOf(en, "job.sign") }).first();
const deal = (page: Page) => page.getByLabel(t(en, "a11y.deal")).first();

/** How long one tap may wait while the job card redraws under it, before the talk loop looks again. */
const TAP_MS = 15_000;

/**
 * The agents talk: questions answered, offers made, each owner signs; the questions asked, whether both signed, and
 * each tap that found its button gone or stuck (a job card redrawn mid-tap), kept so a stuck button shows in the report.
 */
export async function agentsTalk(worker: Page, home: Page, p: KindPersona, waitMs: number) {
  await open(worker, "nav.activity", en);
  for (const page of [worker, home]) page.setDefaultTimeout(TAP_MS);
  const questions: string[] = [];
  const stuck: string[] = [];
  const end = Date.now() + waitMs;
  while (Date.now() < end) {
    if ((await deal(home).isVisible()) && (await deal(worker).isVisible())) return { questions, stuck, signed: true };
    try {
      const form = home.getByRole("form", { name: t(en, "a11y.answer") });
      if (await form.isVisible()) questions.push(...(await answerQuestions(home, p)));
      for (const page of [home, worker]) await tapIf(signButton(page));
    } catch (err) {
      stuck.push(err instanceof Error ? (err.message.split("\n")[0] ?? "") : String(err));
    }
    await home.waitForTimeout(2_000);
  }
  return { questions, stuck, signed: false };
}
