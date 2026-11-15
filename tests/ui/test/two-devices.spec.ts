import { type MessageKey, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { MovePrompt, newPhone, open, openAllRows, Role, RUN, shoot, signIn } from "./helpers.js";
import { fillAsk, publishCard, unlistCards } from "./journey.js";

/**
 * A worker signed in on two phones, both open, gets one request (ADR 0045). The request reaches both, but only the
 * phone that claims it first lets its agent answer: the household's phone sees one negotiation, never an envelope out
 * of turn, and the other phone says the request is being answered elsewhere.
 */

const en = Lang.enum.en;
const say = (key: MessageKey) => t(en, key);
const FOLDER = "two-devices";
const OUT_OF_TURN = "envelope out of turn";
/** Three rounds of offers between the agents, each a few mailbox polls. */
const NEGOTIATION_MS = 180_000;
const SIGN = /^Sign deal for/;
const workerName = `Kiran ${RUN}`;
const householdName = `Lata ${RUN}`;

let contexts: BrowserContext[] = [];
test.afterAll(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
});

test("a worker's two open phones answer one request once", async ({ browser }) => {
  test.setTimeout(420_000);
  contexts = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const [first, second, household] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page, Page];
  const householdLog: string[] = [];
  household.on("console", (m) => householdLog.push(m.text()));
  const workerPhone = newPhone();

  await signIn(first, { role: Role.worker, name: workerName, phone: workerPhone });
  await publishCard(
    { page: first, lang: en },
    { trade: "Electrician", area: "indiranagar", rate: "700", min: "550", about: "Fans and switchboards" },
  );
  // The same number on a second phone, keeping the first: both stay signed in and both fetch the mail.
  await signIn(second, { role: Role.worker, name: workerName, phone: workerPhone, elsewhere: MovePrompt.notNow });
  // The second phone's card came back from GigSync without the lowest price; the worker gives it on Home there too,
  // so whichever phone claims the request quotes at once instead of waiting for the worker.
  await Promise.all([open(first, "nav.activity"), open(second, "nav.jobs")]);
  const floor = second.getByRole("form", { name: say("phone.floor_title") });
  await floor.getByLabel(say("phone.floor_label")).fill("550");
  await floor.getByRole("button", { name: say("settings.save") }).click();
  await expect(floor).toHaveCount(0);
  await open(second, "nav.activity");

  await signIn(household, {
    role: Role.consumer,
    name: householdName,
    phone: newPhone(),
    address: `Flat 9 (${RUN})`,
    area: "Indiranagar",
  });
  await fillAsk(
    { page: household, lang: en },
    {
      trade: "electrician",
      area: "Indiranagar",
      worker: workerName,
      need: "Fan not working",
      when: "when.today",
      budget: "700",
    },
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

  // One negotiation reached a deal to sign: the household or the answering phone is asked first, as the agents met.
  const signs = (page: Page) => page.getByRole("button", { name: SIGN }).count();
  await expect
    .poll(async () => (await signs(household)) + (await signs(first)) + (await signs(second)), {
      timeout: NEGOTIATION_MS,
    })
    .toBe(1);
  // Exactly one phone says the other is answering, on the request it keeps to show (its line opened to read it).
  const elsewhere = (page: Page) => page.getByText(say("job.elsewhere"));
  await expect
    .poll(
      async () => {
        await Promise.all([openAllRows(first), openAllRows(second)]);
        return (await elsewhere(first).count()) + (await elsewhere(second).count());
      },
      { timeout: 30_000 },
    )
    .toBe(1);
  const [answering, mirroring] = (await elsewhere(first).count()) > 0 ? [second, first] : [first, second];
  await expect(elsewhere(answering)).toHaveCount(0);
  // A worker's card names the household only once both signed; until then it is "Customer".
  const card = mirroring.getByRole("article", { name: t(en, "a11y.job_with", { name: say("job.customer") }) });
  await expect(card).toContainText(say("job.elsewhere"));
  expect(await signs(mirroring)).toBe(0);
  await shoot("one-answers", { answering, mirroring, household }, FOLDER);

  expect(householdLog.filter((line) => line.includes(OUT_OF_TURN))).toEqual([]);
});
