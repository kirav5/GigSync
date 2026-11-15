import { type MessageKey, type Params, plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { chooseLanguage, completeSignIn, newPhone, open, Role, RUN, reveal, shoot, signIn } from "./helpers.js";
import { finishWork } from "./jobs.js";
import { fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";

/**
 * A household recommends a worker to someone it knows (ADR 0055), through the app's screens against the real API and
 * mailbox: after a real job, the household gets the worker's link and sends it out of GigSync; the friend, who has no
 * account, opens it, signs up and can ask the worker, whose number shows nowhere; the worker's phone is told. WhatsApp
 * itself is stood in for at its address, so the words and the link it would get can be read.
 */

const { en, hi } = Lang.enum;
const FOLDER = "recommend";
const WHATSAPP = "https://wa.me/**";
const RECOMMEND_ROUTE = "**/v1/qr/recommend";
const WHATSAPP_TEXT = "text";
const LINK_IN_WORDS = /https?:\/\/\S+$/;
const say = (key: MessageKey, params?: Params) => t(en, key, params);

let contexts: BrowserContext[] = [];
test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phones(browser: { newContext: () => Promise<BrowserContext> }): Promise<[Page, Page, Page]> {
  contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  return (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page, Page];
}

/** A plumber and a household on one job both signed and finished, from the household's request to the worker's Done. */
async function finishedJob(worker: Phone, household: Phone, names: { worker: string; household: string }) {
  const workerPhone = newPhone();
  await signIn(worker.page, { role: Role.worker, name: names.worker, phone: workerPhone, lang: worker.lang });
  await publishCard(worker, {
    trade: t(worker.lang, "trade.plumber"),
    area: "jayanagar",
    rate: "800",
    min: "600",
    about: "Taps and pipes",
  });
  await open(worker.page, "nav.activity", worker.lang);
  await signIn(household.page, {
    role: Role.consumer,
    name: names.household,
    phone: newPhone(),
    address: `No. 9, 4th Block (${RUN})`,
    area: "Jayanagar",
  });
  await fillAsk(household, {
    trade: "plumber",
    area: "Jayanagar",
    worker: names.worker,
    need: "Need a plumber",
    when: "when.today",
    budget: "750",
  });
  await household.page.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  const answer = household.page.getByRole("form", { name: say("a11y.answer") });
  await answer.getByLabel(questionText(en, "problem")).fill("Tap keeps dripping");
  await answer.getByRole("button", { name: say("job.send_answers") }).click();
  await signBoth({ worker, household }, FOLDER);
  const card = worker.page.getByRole("article", { name: t(worker.lang, "a11y.job_with", { name: names.household }) });
  await finishWork(card, worker.lang);
  return workerPhone;
}

/** The household's job card with the worker, wherever the job has got to. */
async function jobCard(page: Page, name: string) {
  const card = page.getByRole("article", { name: say("a11y.job_with", { name }) });
  await reveal(page, card.getByRole("button", { name: say("qr.recommend", { name }) }));
  return card;
}

test("a household recommends a worker to a friend, who signs up and can ask them; the worker is told", async ({
  browser,
}) => {
  const [ganesh, lakshmi, meera] = await phones(browser);
  const worker: Phone = { page: ganesh, lang: hi };
  const household: Phone = { page: lakshmi, lang: en };
  const names = { worker: `Ganesh ${RUN}`, household: `Lakshmi ${RUN}` };
  const shots = { worker: ganesh, household: lakshmi, friend: meera };
  const workerPhone = await finishedJob(worker, household, names);
  const name = names.worker;

  // ── The old worker-to-worker introduction is gone from the job card ────────────────────────────────────────────
  const card = await jobCard(lakshmi, name);
  await expect(card.getByRole("button", { name: say("mentor.introduce", { name }) })).toHaveCount(0);

  // ── While the link is on its way the button shows it is working, and a second tap sends nothing more ───────────
  let asked = 0;
  let answer = () => {};
  const held = new Promise<void>((resolve) => {
    answer = resolve;
  });
  await lakshmi.route(RECOMMEND_ROUTE, async (route) => {
    asked += 1;
    await held;
    await route.continue();
  });
  const recommend = card.getByRole("button", { name: say("qr.recommend", { name }) });
  await recommend.click();
  await expect(recommend).toHaveAttribute("aria-busy", "true");
  await expect(recommend).toBeDisabled();
  await recommend.click({ force: true }).catch(() => undefined);
  answer();

  // ── Recommend gets the link; WhatsApp opens with the household's words and the link, and no number ─────────────
  await contexts[1]?.route(WHATSAPP, (route) => route.fulfill({ contentType: "text/html", body: "" }));
  const send = card.getByRole("group", { name: say("qr.recommend", { name }) });
  await expect(send).toContainText(say("qr.recommend_about", { name }));
  expect(asked).toBe(1);
  await shoot("recommend", shots, FOLDER);
  const whatsApp = send.getByRole("link", { name: say("qr.recommend_whatsapp") });
  const href = (await whatsApp.getAttribute("href")) ?? "";
  const words = new URL(href).searchParams.get(WHATSAPP_TEXT) ?? "";
  expect(words).toContain(name);
  expect(words).not.toContain(workerPhone.replace("+91", ""));
  const link = words.match(LINK_IN_WORDS)?.[0] ?? "";
  expect(link).toContain("?to=");
  const opened = lakshmi.waitForEvent("popup");
  await whatsApp.click();
  await (await opened).close();
  await expect(card.getByRole("status").filter({ hasText: say("qr.recommend_told", { name }) })).toBeVisible();

  // ── The worker is told on Jobs, in their language, until they tap OK ────────────────────────────────────────────
  await open(ganesh, "nav.jobs", hi);
  const told = t(hi, "qr.recommended", { name: names.household });
  const note = ganesh.getByRole("article", { name: told });
  await expect(note).toBeVisible();
  await shoot("worker-told", shots, FOLDER);
  await note.getByRole("button", { name: t(hi, "qr.recommended_ok") }).click();
  await expect(note).toHaveCount(0);

  // ── The friend has no account: the link waits through sign-up, then shows the card and Ask, with no number ─────
  await meera.goto(link);
  await expect(meera).not.toHaveURL(/to=/);
  await chooseLanguage(meera, en);
  await completeSignIn(meera, { role: Role.consumer, name: `Meera ${RUN}`, phone: newPhone() });
  await expect(meera.getByRole("button", { name: say("qr.ask", { name }) })).toBeVisible();
  await expect(meera.getByText("Taps and pipes")).toBeVisible();
  await expect(meera.getByText(workerPhone.replace("+91", ""))).toHaveCount(0);
  await shoot("friend-opens", shots, FOLDER);
  await meera.getByRole("button", { name: say("qr.ask", { name }) }).click();
  await expect(meera.getByRole("log")).toContainText(say("need.start_to", { name }));
});
