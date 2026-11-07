import { type MessageKey, type Params, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
  listWorker,
  MovePrompt,
  newPhone,
  open,
  Role,
  RUN,
  shoot,
  showTab,
  signIn,
  statusTag,
  textOf,
} from "./helpers.js";
import { fillAsk, publishCard, signBoth, unlistCards } from "./journey.js";
import { drawer, openDrawer } from "./menu.js";

/**
 * A worker's phone loses its jobs mid-job (a fresh browser, or one that cleared its storage) and rebuilds them from
 * the record on sign-in. The rebuilt card can still be marked done; the household's phone follows the record; both
 * cards show the same progress line with times; and the household can ask the same worker again, on his new phone.
 */

const en = Lang.enum.en;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const INDIRANAGAR = { lat: 12.9719, lon: 77.6412 };
const FOLDER = "job-restored";
const workerName = `Ravi ${RUN}`;
const householdName = `Meena ${RUN}`;

let contexts: BrowserContext[] = [];
test.afterAll(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
});

const progress = (page: Page) => page.getByRole("list", { name: say("progress.title") });
const step = (page: Page, key: MessageKey) =>
  progress(page)
    .getByRole("listitem")
    .filter({ hasText: say(key) });

/** The household asks for this worker by name; answers the worker's agent's question if it asks one. */
async function ask(household: Page, need: string) {
  await fillAsk(
    { page: household, lang: en },
    { trade: "electrician", area: "Indiranagar", worker: workerName, need, when: "when.today", budget: "700" },
  );
  await household.getByRole("button", { name: "Ask 1 worker" }).click();
  const question = household.getByRole("form", { name: say("a11y.answer") });
  await question
    .waitFor({ timeout: 20_000 })
    .then(async () => {
      await question.getByRole("textbox").first().fill("The ceiling fan hums but does not spin");
      await question.getByRole("button", { name: say("job.send_answers") }).click();
    })
    .catch(() => undefined);
}

test("a rebuilt job can still be finished, both phones agree on its progress, and the same worker can be asked again", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  contexts = [await browser.newContext(), await browser.newContext()];
  const [worker, household] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const workerPhone = newPhone();
  await listWorker(`Babu ${RUN}`, ["plumber"], { lat: INDIRANAGAR.lat, lon: INDIRANAGAR.lon + 0.01 }, 60000);

  await signIn(worker, { role: Role.worker, name: workerName, phone: workerPhone });
  await publishCard(
    { page: worker, lang: en },
    { trade: "Electrician", area: "indiranagar", rate: "700", min: "550", about: "Fans and switchboards" },
  );
  await signIn(household, {
    role: Role.consumer,
    name: householdName,
    phone: newPhone(),
    address: `Flat 4 (${RUN})`,
    area: "Indiranagar",
  });
  await open(worker, "nav.activity");
  await ask(household, "Fan not working");
  await signBoth({ worker: { page: worker, lang: en }, household: { page: household, lang: en } }, FOLDER);

  // Both signed: each card shows the line, agreed now and the rest ahead.
  await showTab(worker, "activity.tab_agreed");
  const workerJob = worker.getByRole("article", { name: say("a11y.job_with", { name: householdName }) });
  await expect(step(worker, "progress.agreed")).toHaveAttribute("aria-current", "step");
  await workerJob.getByRole("button", { name: say("update.on_my_way") }).click();
  // His card moves to On the way with its time, and does not list it again as a note.
  await expect(step(worker, "progress.on_my_way").locator("time")).toBeVisible();
  await expect(workerJob.getByLabel(say("a11y.notes"))).toHaveCount(0);
  // The household's card moves to On the way, with when.
  await expect(step(household, "progress.on_my_way")).toHaveAttribute("aria-current", "step");
  await expect(step(household, "progress.on_my_way").locator("time")).toBeVisible();
  await shoot("on-the-way", { worker, household }, FOLDER);

  // ── The worker's phone loses its jobs: a fresh browser, signed in with the same number ────────────────────────
  // The old one is gone (its storage cleared, or the phone lost): nothing of it answers any more.
  await contexts[0]?.close();
  const fresh = await browser.newContext();
  contexts.push(fresh);
  const again = await fresh.newPage();
  await signIn(again, { role: Role.worker, name: workerName, phone: workerPhone, elsewhere: MovePrompt.notNow });
  await open(again, "nav.activity");
  await showTab(again, "activity.tab_agreed");
  const rebuilt = again.getByRole("article").filter({ hasText: say("contacts.restored") });
  await expect(rebuilt).toBeVisible();
  // It says why, and can be finished: marked done, or cancelled after a second tap.
  await expect(rebuilt).toContainText(say("restored.why", { name: say("job.customer") }).slice(0, 30));
  await expect(rebuilt.getByRole("button", { name: say("restored.cancel") })).toBeVisible();
  await shoot("rebuilt", { worker: again, household }, FOLDER);
  await rebuilt.getByRole("button", { name: say("job.mark_done") }).click();
  // Done on this phone: the card stays among today's jobs, marked done, with nothing left to end.
  await expect(statusTag(rebuilt, en, "status.delivered")).toBeVisible();
  await expect(rebuilt.getByRole("button", { name: say("job.mark_done") })).toHaveCount(0);

  // ── The household's phone follows the record: Done, with when, on the next look ───────────────────────────────
  // No reload: the app reads the record again every minute and whenever it comes back to the front.
  await expect(step(household, "progress.done")).toHaveAttribute("aria-current", "step", { timeout: 90_000 });
  await expect(step(household, "progress.done").locator("time")).toBeVisible();
  await shoot("done-from-record", { worker: again, household }, FOLDER);

  // ── She asks the same worker again, from a new chat; his rebuilt phone gets the request ───────────────────────
  await openDrawer(household);
  await drawer(household)
    .getByRole("button", { name: say("chats.new"), exact: true })
    .click();
  await ask(household, "Switchboard sparking");
  // The request reaches his rebuilt phone (sealed to it too, not only to the phone he lost). His lowest price stayed
  // on the old phone, so his agent asks him before quoting; he says go ahead.
  await open(again, "nav.activity");
  await showTab(again, "activity.tab_awaiting");
  const check = again.getByRole("group", { name: say("a11y.approve") });
  await check.getByRole("button", { name: textOf(en, "approve.yes") }).click({ timeout: 60_000 });
  // His agent took it up: its offers reach her, whatever the two agents then come to (ADR 0053).
  await expect(
    household
      .getByRole("list", { name: say("talk.title") })
      .getByRole("listitem")
      .nth(1),
  ).toContainText(workerName, { timeout: 90_000 });
  await shoot("asked-again", { worker: again, household }, FOLDER);
});
