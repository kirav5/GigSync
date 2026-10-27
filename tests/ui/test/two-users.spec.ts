import type { ApiClient } from "@gigsync/core";
import { type BrowserContext, expect, type Page, test } from "@playwright/test";
import { listWorker, newPhone, open, Role, RUN, shoot, signIn } from "./helpers.js";

/**
 * Two people on two phones, through the app's real screens, against the real API and Neon: Priya needs an
 * electrician, Anil is one. Each phone has its own keys and storage (its own browser profile). Mirrors Collab's
 * server/test/e2e.test.ts journey, but driven by tapping the screens each person sees.
 */

const INDIRANAGAR = { lat: 12.9719, lon: 77.6412 };
const anilName = `Anil ${RUN}`;
const priyaName = `Priya ${RUN}`;
const ADDRESS = `Flat 302, 3rd floor, 5th Cross (${RUN})`;

let contexts: BrowserContext[] = [];
let others: ApiClient[] = [];

test.afterAll(async () => {
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

  // ── Anil signs in and publishes his card: public rate ₹700, private minimum ₹550 ─────────────────────────────
  await signIn(anil, { role: Role.worker, name: anilName, phone: newPhone() });
  const card = anil.getByRole("form", { name: "My card" });
  await card.getByRole("button", { name: "Electrician", exact: true }).click();
  await card.getByLabel("Where I work").selectOption("Indiranagar");
  await card.getByLabel(/^Usual rate/).fill("700");
  await card.getByLabel(/^Lowest I will take/).fill("550");
  await card.getByLabel(/^UPI ID/).fill("anil.test@okaxis");
  await card.getByLabel("About my work").fill("Wiring, fans and switchboards, 10 years");
  await card.getByRole("button", { name: "Publish my card" }).click();
  await expect(card.getByText(/On the board: Electrician in Indiranagar from ₹700/)).toBeVisible();

  // ── Priya signs in and finds electricians near Indiranagar ──────────────────────────────────────────────────────
  await signIn(priya, { role: Role.consumer, name: priyaName, phone: newPhone(), address: ADDRESS });
  await priya.getByLabel("Trade").selectOption("electrician");
  await priya.getByLabel("Area").selectOption("Indiranagar");
  await priya.getByRole("button", { name: "Search" }).click();
  await expect(priya.getByLabel(`Worker ${anilName}`)).toBeVisible();
  await expect(priya.getByLabel(`Worker Babu ${RUN}`)).toBeVisible();
  await expect(priya.getByLabel(`Worker Esha ${RUN}`)).toHaveCount(0); // a plumber, not shown for electricians
  await expect(priya.getByText("9800")).toHaveCount(0); // no phone numbers on the board
  await shoot("discover", phones);

  // She asks only Anil, without saying what is wrong, and keeps ₹650 as her private limit.
  for (const box of await priya.getByRole("checkbox", { checked: true }).all()) await box.uncheck();
  await priya.getByRole("checkbox", { name: `Ask ${anilName}` }).check();
  await priya.getByLabel("What you need").fill("Ceiling fan stopped working");
  await priya.getByLabel("When").fill("Tomorrow 10am");
  await priya.getByLabel(/^Most I will pay/).fill("650");
  await priya.getByRole("button", { name: "Ask 1 worker" }).click();

  // ── Anil's agent asks what is wrong; Priya's agent cannot know, so it asks her ────────────────────────────────
  await open(anil, "Requests");
  const question = priya.getByRole("form", { name: "Answer the worker" });
  await expect(question).toBeVisible();
  await expect(anil.getByText("Question asked")).toBeVisible();
  await shoot("worker-asks", phones);
  await question.getByLabel("What exactly isn't working?").fill("It hums but does not spin");
  await question.getByRole("button", { name: "Send answers" }).click();

  // ── The agents haggle inside both limits; then each owner signs ───────────────────────────────────────────────
  const first = await whichever([anil, priya], /^Sign deal for/);
  await expect(first.getByRole("list", { name: "Offers" })).toBeVisible();
  await expect(priya.getByLabel("Contact")).toHaveCount(0);
  await expect(anil.getByLabel("Contact")).toHaveCount(0);
  await shoot("agents-agree", phones);
  await first.getByRole("button", { name: /^Sign deal for/ }).click();
  const second = first === anil ? priya : anil;
  await expect(second.getByRole("button", { name: /^Sign deal for/ })).toBeVisible();
  await expect(first.getByText("Waiting for a signature")).toBeVisible();
  await shoot("one-signed", phones);
  await second.getByRole("button", { name: /^Sign deal for/ }).click();

  // ── Both signed: contacts cross, and only now ─────────────────────────────────────────────────────────────────
  await expect(priya.getByLabel("Contact")).toContainText(anilName);
  await expect(anil.getByLabel("Contact")).toContainText(ADDRESS);
  const deal = ((await priya.getByLabel("Deal").textContent()) ?? "").match(/₹(\d+)/)?.[1];
  expect(Number(deal)).toBeGreaterThanOrEqual(550);
  expect(Number(deal)).toBeLessThanOrEqual(650);
  await expect(anil.getByLabel("Deal")).toContainText(`₹${deal}`);
  await shoot("signed-contacts", phones);

  // ── Work, then UPI payment for the signed amount ──────────────────────────────────────────────────────────────
  await anil.getByRole("button", { name: "On my way" }).click();
  await anil.getByRole("button", { name: "Mark done" }).click();
  await anil.getByRole("button", { name: "Ask for payment" }).click();
  const payBox = priya.getByRole("form", { name: "Pay" });
  await expect(payBox.getByRole("img", { name: "UPI QR code" })).toBeVisible();
  await expect(payBox.getByRole("link", { name: "Open in a UPI app" })).toHaveAttribute(
    "href",
    new RegExp(`pa=anil\\.test@okaxis.*am=${deal}\\.00`),
  );
  await shoot("pay-by-upi", phones);
  await payBox.getByLabel("UPI reference").fill("412345678901");
  await payBox.getByRole("button", { name: "I've paid" }).click();

  await expect(anil.getByRole("button", { name: "Money received" })).toBeVisible();
  await shoot("confirm-payment", phones);
  await anil.getByRole("button", { name: "Money received" }).click();

  // ── Priya rates the job; it is closed on both phones ──────────────────────────────────────────────────────────
  const review = priya.getByRole("form", { name: "Review" });
  await expect(review).toBeVisible();
  await review.getByLabel("Review text").fill("Quick and tidy");
  await review.getByRole("button", { name: "Send review" }).click();
  await expect(anil.getByLabel("Review")).toContainText("★★★★★ Quick and tidy");
  await expect(anil.getByText("Closed")).toBeVisible();
  await expect(priya.getByText("Closed")).toBeVisible();
  await expect(priya.getByLabel("Payment")).toContainText("confirmed");
  await shoot("paid-rated-closed", phones);

  // Anil takes his card off the board so later runs start clean.
  await open(anil, "My card");
  await anil.getByRole("button", { name: "Take my card off the board" }).click();
  await expect(anil.getByText("Off the board")).toBeVisible();
});
