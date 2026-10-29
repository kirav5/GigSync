import { type ApiClient, type MessageKey, type Params, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import {
  counted,
  expand,
  inSection,
  listWorker,
  newPhone,
  open,
  openCard,
  Role,
  RUN,
  reveal,
  setUpi,
  shoot,
  signIn,
  tabs,
} from "./helpers.js";
import { fillAsk, publishCard, unlistCards } from "./journey.js";

/**
 * Two people on two phones, through the app's real screens, against the real API and Neon: Priya needs an
 * electrician, Anil is one. Each phone has its own keys and storage (its own browser profile). Mirrors Collab's
 * server/test/e2e.test.ts journey, but driven by tapping the screens each person sees.
 */

const en = Lang.enum.en;
const say = (key: MessageKey, params?: Params) => t(en, key, params);
const INDIRANAGAR = { lat: 12.9719, lon: 77.6412 };
const anilName = `Anil ${RUN}`;
const priyaName = `Priya ${RUN}`;
const ADDRESS = `Flat 302, 3rd floor, 5th Cross (${RUN})`;
const UTR = "412345678901";
/** The manual flow's tabs, gone with it. Written out: their keys are deleted after this change. */
const GONE_TABS = ["Jobs in person", "Get paid", "My record"];
const SIGN = /^Sign deal for/;

let contexts: BrowserContext[] = [];
let others: ApiClient[] = [];

test.afterAll(async () => {
  await unlistCards();
  await Promise.all(others.map((a) => a.removeProfile()));
  await Promise.all(contexts.map((c) => c.close()));
});

/** Waits until either phone shows the button, and returns that phone. */
async function whichever(phones: Page[], name: RegExp): Promise<Page> {
  await expect(async () => {
    const seen = await Promise.all(phones.map((p) => p.getByRole("button", { name }).isVisible()));
    expect(seen.some(Boolean)).toBe(true);
  }).toPass();
  for (const p of phones) if (await p.getByRole("button", { name }).isVisible()) return p;
  throw new Error(`no phone shows ${name}`);
}

test("Priya finds an electrician, their agents agree, both sign, contacts swap, he is paid and rated", async ({
  browser,
}) => {
  contexts = [await browser.newContext(), await browser.newContext()];
  const [anil, priya] = (await Promise.all(contexts.map((c) => c.newPage()))) as [Page, Page];
  const phones = { worker: anil, customer: priya };
  others = await Promise.all([
    listWorker(
      `Babu ${RUN}`,
      ["electrician", "ac_technician"],
      { lat: INDIRANAGAR.lat + 0.012, lon: INDIRANAGAR.lon },
      65000,
    ),
    listWorker(`Esha ${RUN}`, ["plumber"], { lat: INDIRANAGAR.lat, lon: INDIRANAGAR.lon + 0.01 }, 60000),
  ]);

  // ── Anil signs in: four tabs, none of the manual flow's ───────────────────────────────────────────────────────
  await signIn(anil, { role: Role.worker, name: anilName, phone: newPhone() });
  await expect(tabs(anil).getByRole("button")).toHaveCount(4);
  for (const gone of GONE_TABS) await expect(tabs(anil).getByRole("button", { name: gone })).toHaveCount(0);

  // He publishes his card: public rate ₹700, private minimum ₹550. It has no UPI field; that is in Profile alone.
  await publishCard(
    { page: anil, lang: en },
    { trade: "Electrician", area: "indiranagar", rate: "700", min: "550", about: "Wiring, fans and switchboards" },
  );
  await expect(anil.getByRole("form", { name: say("a11y.my_card") }).getByLabel(/UPI/)).toHaveCount(0);
  const onBoard = say("card.on_board", { trades: "Electrician", area: "Indiranagar", price: "₹700" });
  await expect(anil.getByRole("status").filter({ hasText: onBoard })).toBeVisible();
  // The app restarts: the keys his phone registered at sign-in must be the keys it kept, or Priya's request,
  // sealed to them, cannot be opened.
  await anil.reload();
  await expect(tabs(anil)).toBeVisible();

  // ── Priya signs in and finds electricians near Indiranagar; she asks only Anil, for today ──────────────────────
  await signIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: ADDRESS });
  // She does not say what is wrong, and keeps ₹650 as her private limit.
  await fillAsk(
    { page: priya, lang: en },
    {
      trade: "electrician",
      area: "Indiranagar",
      worker: anilName,
      need: "Ceiling fan stopped working",
      when: "when.today",
      budget: "650",
    },
  );
  await expect(priya.getByLabel(`Worker Babu ${RUN}`)).toBeVisible();
  await expect(priya.getByLabel(`Worker Esha ${RUN}`)).toHaveCount(0); // a plumber, not shown for electricians
  await expect(priya.getByText("9800")).toHaveCount(0); // no phone numbers on the board
  await shoot("discover", phones);
  await priya.getByRole("button", { name: "Ask 1 worker" }).click();

  // ── Anil's agent asks what is wrong; Priya's agent cannot know, so it asks her ────────────────────────────────
  await open(anil, "nav.today");
  const question = priya.getByRole("form", { name: say("a11y.answer") });
  await expect(question).toBeVisible();
  // Waiting on her, his job is folded under the agents' talks.
  await expand(anil, counted(en, "home.talking"));
  await expect(anil.getByText(say("status.clarifying"), { exact: true })).toBeVisible();
  await shoot("worker-asks", phones);
  await question.getByLabel("What exactly isn't working?").fill("It hums but does not spin");
  await question.getByRole("button", { name: say("job.send_answers") }).click();

  // ── The agents haggle inside both limits; then each owner signs. Anil's deal waits under "Decide now" ─────────
  const signOn = (p: Page) => (p === anil ? inSection(anil, "home.decide") : p).getByRole("button", { name: SIGN });
  const first = await whichever([anil, priya], SIGN);
  await expand(first, "home.details");
  await expect(first.getByRole("list", { name: say("a11y.offers") })).toBeVisible();
  await expect(priya.getByLabel(say("a11y.contact"))).toHaveCount(0);
  await expect(anil.getByLabel(say("a11y.contact"))).toHaveCount(0);
  await shoot("agents-agree", phones);
  await signOn(first).click();
  const second = first === anil ? priya : anil;
  await expect(signOn(second)).toBeVisible();
  // Signed and waiting on the other side, the job has no decision left, so it folds away with the agents' talks.
  await reveal(first, first.getByText(say("status.confirming"), { exact: true }));
  await shoot("one-signed", phones);
  await signOn(second).click();

  // ── Both signed: contacts cross, and only now. She asked for today, so it is one of his jobs for today ─────────
  await expect(priya.getByLabel(say("a11y.contact"))).toContainText(anilName);
  await expect(inSection(anil, "home.today").getByLabel(say("a11y.contact"))).toContainText(ADDRESS);
  const deal = ((await priya.getByLabel(say("a11y.deal")).textContent()) ?? "").match(/₹(\d+)/)?.[1];
  expect(Number(deal)).toBeGreaterThanOrEqual(550);
  expect(Number(deal)).toBeLessThanOrEqual(650);
  await expect(anil.getByLabel(say("a11y.deal"))).toContainText(`₹${deal}`);
  await shoot("signed-contacts", phones);

  // ── Work, then UPI payment for the signed amount ──────────────────────────────────────────────────────────────
  const job = anil.getByRole("article", { name: say("a11y.job_with", { name: priyaName }) });
  const askPayment = job.getByRole("button", { name: say("job.ask_payment"), exact: true });
  await job.getByRole("button", { name: say("update.on_my_way") }).click();
  await job.getByRole("button", { name: say("job.mark_done") }).click();
  // He asks before saving a UPI ID: the job says where it goes, and takes him there.
  await askPayment.click();
  await expect(job.getByText(say("money.need_upi"))).toBeVisible();
  await job.getByRole("button", { name: say("money.add_upi") }).click();
  await expect(tabs(anil).getByRole("button", { name: say("nav.profile") })).toHaveAttribute("aria-current", "page");
  await setUpi(anil, en, "anil.test@okaxis");
  await open(anil, "nav.today");
  await askPayment.click();
  // Asked and waiting on her: he sees whom he waits for, and nothing to confirm or dispute until she says she paid.
  const waiting = job.getByText(say("money.waiting", { name: priyaName, price: `₹${deal}` }));
  await expect(waiting).toBeVisible();
  await expect(job.getByRole("button", { name: say("money.show_qr") })).toBeVisible();
  await expect(job.getByRole("button", { name: say("job.money_received") })).toHaveCount(0);
  await expect(job.getByRole("button", { name: say("job.not_received") })).toHaveCount(0);

  const payBox = priya.getByRole("form", { name: say("a11y.pay") });
  await expect(payBox.getByRole("img", { name: say("a11y.qr") })).toBeVisible();
  await expect(payBox.getByRole("link", { name: say("job.open_upi") })).toHaveAttribute(
    "href",
    new RegExp(`pa=anil\\.test@okaxis.*am=${deal}\\.00`),
  );
  await shoot("pay-by-upi", phones);
  await payBox.getByLabel(say("a11y.utr")).fill(UTR);
  await payBox.getByRole("button", { name: say("job.paid") }).click();

  // Her "paid", with its UPI reference, is what he confirms.
  const confirm = anil.getByRole("group", { name: say("a11y.confirm_payment") });
  await expect(confirm).toBeVisible();
  await expect(waiting).toHaveCount(0);
  await shoot("confirm-payment", phones);
  await confirm.getByRole("button", { name: say("job.money_received") }).click();

  // ── His passbook: the job both signed, her reference, this week's total; nothing left to ask for ───────────────
  const amount = `₹${deal}`;
  await open(anil, "nav.passbook");
  const rows = anil.getByRole("region", { name: say("record.title") });
  for (const text of [
    amount,
    priyaName,
    say("record.state_received", { price: amount }),
    say("payrow.ref", { utr: UTR }),
  ]) {
    await expect(rows).toContainText(text);
  }
  await expect(anil.getByText(say("passbook.week"), { exact: true }).locator("xpath=..")).toContainText(amount);
  await shoot("passbook", phones);
  // Paid once for a one-off job: it moves to Earlier, and never offers to ask again.
  await open(anil, "nav.today");
  await expand(anil, "home.earlier");
  await expect(job).toBeVisible();
  await expect(job.getByRole("button", { name: say("money.ask_again") })).toHaveCount(0);
  await expect(job.getByRole("button", { name: say("money.ask_month") })).toHaveCount(0);

  // ── Priya rates the job; it is closed on both phones, under Earlier ───────────────────────────────────────────
  const review = priya.getByRole("form", { name: say("a11y.review") });
  await reveal(priya, review);
  await review.getByLabel(say("a11y.review_text")).fill("Quick and tidy");
  await review.getByRole("button", { name: say("job.send_review") }).click();
  await expand(anil, "home.earlier");
  await expect(job.getByLabel(say("a11y.review"))).toContainText("★★★★★ Quick and tidy");
  await expect(job.getByText(say("status.closed"), { exact: true })).toBeVisible();
  await expand(priya, "home.earlier");
  await expect(priya.getByText(say("status.closed"), { exact: true })).toBeVisible();
  await expect(priya.getByLabel(say("a11y.payment"))).toContainText(say("pay.thread.confirmed"));
  await shoot("paid-rated-closed", phones);

  // Anil takes his card off the board so later runs start clean.
  await openCard(anil);
  await anil.getByRole("button", { name: say("card.unlist") }).click();
  await open(anil, "nav.profile");
  await expect(anil.getByText(say("profile.card_off"))).toBeVisible();
});
