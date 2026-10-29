import { plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { type Browser, type BrowserContext, expect, test } from "@playwright/test";
import { inSection, newPhone, open, Role, RUN, reveal, shoot, signIn, tabs, textOf } from "./helpers.js";
import { fillAsk, type Phone, publishCard, signBoth, unlistCards } from "./journey.js";
import { pairKey, type TranslationTable, useTableTranslator } from "./translator.js";

/**
 * Worker to worker (round2-spec §3.3) through the app's real screens. Two workers who met link with a colleague code
 * (here pasted through the dev-only field, as a test browser has no camera to scan with), write to each other in
 * Hindi and Kannada and each reads the other in their own language; one turns down a household's request and suggests
 * the other, whom the household then asks. Then a worker hires a helper from Talk, from the work site question to both
 * signatures.
 */

const { hi, kn, en } = Lang.enum;
/** How the app marks other people's words that it translated (ui/Said.tsx). */
const TRANSLATED = '[data-said="translated"]';
/** Dev builds only: the colleague code's text, on its QR (screens/colleague/ShowCode.tsx). */
const INVITE = "data-invite";

const KN_HELLO = "ನಮಸ್ಕಾರ, ನಾಳೆ ಕೆಲಸ ಇದೆಯಾ?";
const HI_HELLO = "कल सुबह खाली हूँ";
const TABLE: TranslationTable = {
  [pairKey(kn, hi, KN_HELLO)]: "नमस्ते, कल काम है क्या?",
  [pairKey(hi, kn, HI_HELLO)]: "ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಬಿಡುವಾಗಿದ್ದೇನೆ",
};

let contexts: BrowserContext[] = [];

test.afterEach(async () => {
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

async function phones(browser: Browser, langs: Lang[]): Promise<Phone[]> {
  contexts = await Promise.all(langs.map(() => browser.newContext()));
  await Promise.all(contexts.map((c) => useTableTranslator(c, TABLE)));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  return pages.map((page, i) => ({ page, lang: langs[i] as Lang }));
}

const pagesOf = (named: Record<string, Phone>) =>
  Object.fromEntries(Object.entries(named).map(([k, p]) => [k, p.page]));

/** Profile's Colleagues section, in the owner's language. */
const colleaguesOn = ({ page, lang }: Phone) => page.getByRole("region", { name: t(lang, "colleague.title") });

/** Sends a note from the open colleague thread's composer. */
async function write({ page, lang }: Phone, to: string, text: string) {
  const box = page.getByRole("form", { name: to });
  await box.getByRole("textbox").fill(text);
  await box.getByRole("button", { name: t(lang, "a11y.send") }).click();
}

/** The status line on a worker's Colleagues list. */
const statusOn = ({ page }: Phone, text: string) => page.getByRole("status").filter({ hasText: text });

test("two workers link in person, write across Hindi and Kannada, and pass on a job", async ({ browser }) => {
  const folder = "colleagues";
  const [asha, bhavya, ravi] = (await phones(browser, [hi, kn, en])) as [Phone, Phone, Phone];
  // The household's phone joins the screenshots once Ravi signs in.
  const workers = pagesOf({ asha, bhavya });
  const shots = pagesOf({ asha, bhavya, household: ravi });
  const ashaName = `Asha ${RUN}`;
  const bhavyaName = `Bhavya ${RUN}`;

  await signIn(asha.page, { role: Role.worker, name: ashaName, phone: newPhone(), lang: hi });
  await signIn(bhavya.page, { role: Role.worker, name: bhavyaName, phone: newPhone(), lang: kn });
  // Both cook in Whitefield; Asha wants to hear about pets first, so a request with a dog stops for her.
  await publishCard(asha, {
    trade: t(hi, "trade.cook"),
    area: "whitefield",
    rate: "9000",
    min: "8000",
    about: "उत्तर भारतीय खाना",
    askFirst: true,
  });
  await publishCard(bhavya, { trade: t(kn, "trade.cook"), area: "whitefield", rate: "8500", min: "7500", about: "ಊಟ" });

  // ── Asha shows her code; Bhavya pastes it (a camera would scan it), sees whose it is, and links ────────────────
  await open(asha.page, "nav.profile", hi);
  await colleaguesOn(asha)
    .getByRole("button", { name: t(hi, "colleague.show_code") })
    .click();
  const qr = asha.page.locator(`[${INVITE}]`);
  await expect(qr).toBeVisible();
  await expect(asha.page.getByRole("timer")).toHaveText(plural(hi, "colleague.code_expires", 10));
  const code = (await qr.getAttribute(INVITE)) ?? "";
  expect(code).toMatch(/^gigsync:colleague\?/);

  await open(bhavya.page, "nav.profile", kn);
  await colleaguesOn(bhavya)
    .getByRole("button", { name: t(kn, "colleague.scan") })
    .click();
  const paste = bhavya.page.getByRole("form", { name: t(kn, "colleague.paste") });
  await paste.getByRole("textbox").fill(code);
  await paste.getByRole("button", { name: t(kn, "colleague.link") }).click();
  const confirm = bhavya.page.getByRole("dialog", { name: t(kn, "colleague.confirm", { name: ashaName }) });
  await expect(confirm).toBeVisible();
  await shoot("code-and-confirm", workers, folder);
  await confirm.getByRole("button", { name: t(kn, "colleague.link") }).click();

  // Linked on both phones once Asha's phone answers; her code screen gives way to the list.
  await expect(statusOn(bhavya, t(kn, "colleague.linked", { name: ashaName }))).toBeVisible();
  await expect(statusOn(asha, t(hi, "colleague.linked", { name: bhavyaName }))).toBeVisible();
  await shoot("linked", workers, folder);

  // ── Bhavya writes in Kannada; Asha sees a dot on Profile and reads it in Hindi; she answers in Hindi ───────────
  await bhavya.page.getByRole("button", { name: new RegExp(ashaName) }).click();
  await expect(bhavya.page.getByText(t(kn, "colleague.thread_empty", { name: ashaName }))).toBeVisible();
  await write(bhavya, ashaName, KN_HELLO);
  await expect(bhavya.page.getByText(KN_HELLO)).toBeVisible();

  await open(asha.page, "nav.today", hi);
  const dot = tabs(asha.page, hi).getByRole("img", { name: plural(hi, "colleague.unread", 1) });
  await expect(dot).toBeVisible();
  await open(asha.page, "nav.profile", hi);
  const row = colleaguesOn(asha).getByRole("button", { name: new RegExp(bhavyaName) });
  await expect(row).toContainText(plural(hi, "colleague.unread", 1));
  await shoot("unread-dot", workers, folder);
  await row.click();
  await expect(asha.page.locator(TRANSLATED)).toHaveText("नमस्ते, कल काम है क्या?");
  await expect(asha.page.getByText(KN_HELLO)).toHaveCount(0);
  await expect(dot).toHaveCount(0);
  await write(asha, bhavyaName, HI_HELLO);
  await expect(bhavya.page.locator(TRANSLATED)).toHaveText("ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಬಿಡುವಾಗಿದ್ದೇನೆ");
  await expect(bhavya.page.getByText(HI_HELLO)).toHaveCount(0);
  await shoot("notes-translated", workers, folder);

  // ── Ravi asks Asha to cook; he has a dog, so her agent stops for her; she declines and suggests Bhavya ─────────
  await signIn(ravi.page, {
    role: Role.consumer,
    name: `Ravi ${RUN}`,
    phone: newPhone(),
    address: `8, ITPL Main Road (${RUN})`,
  });
  await fillAsk(ravi, {
    trade: "cook",
    area: "Whitefield",
    worker: ashaName,
    need: "Dinner for three",
    when: "when.daily",
    budget: "9000",
  });
  await ravi.page.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  await open(asha.page, "nav.today", hi);
  const answer = ravi.page.getByRole("form", { name: t(en, "a11y.answer") });
  await answer.getByLabel(questionText(en, "people")).fill("3");
  await answer.getByLabel(questionText(en, "meals")).fill("Dinner");
  await answer.getByLabel(questionText(en, "pets")).selectOption("yes");
  await answer.getByRole("button", { name: t(en, "job.send_answers") }).click();

  const check = asha.page.getByRole("group", { name: t(hi, "a11y.approve") });
  await expect(check).toBeVisible();
  await check.getByRole("button", { name: t(hi, "approve.no") }).click();
  // Turned down, the request stays under Decide now with a way to pass it on.
  const suggest = inSection(asha.page, "home.decide", hi).getByRole("group", { name: t(hi, "refer.suggest") });
  await expect(suggest).toBeVisible();
  await suggest.getByRole("button", { name: t(hi, "refer.suggest") }).click();
  await expect(suggest.getByText(t(hi, "refer.pick"))).toBeVisible();
  await shoot("suggest-a-colleague", shots, folder);
  await suggest.getByRole("button", { name: t(hi, "refer.send", { name: bhavyaName }) }).click();
  await reveal(asha.page, asha.page.getByText(t(hi, "refer.sent", { name: bhavyaName })));

  // ── Ravi reads the suggestion under Decide now and asks Bhavya; her phone gets the same request ────────────────
  const got = t(en, "refer.got", { worker: ashaName, name: bhavyaName, trade: t(en, "trade.cook") });
  const offer = inSection(ravi.page, "home.decide", en).getByRole("group", { name: got });
  await expect(offer).toBeVisible();
  await shoot("household-gets-suggestion", shots, folder);
  await offer.getByRole("button", { name: t(en, "refer.ask", { name: bhavyaName }) }).click();
  await reveal(ravi.page, ravi.page.getByText(t(en, "refer.asked", { name: bhavyaName })));
  await reveal(ravi.page, ravi.page.getByRole("article", { name: t(en, "a11y.job_with", { name: bhavyaName }) }));
  await open(bhavya.page, "nav.today", kn);
  await reveal(bhavya.page, bhavya.page.getByRole("article", { name: textOf(kn, "a11y.job_with") }).first());
  await expect(bhavya.page.getByRole("article").first()).toContainText(t(kn, "trade.cook"));
  await shoot("colleague-gets-request", shots, folder);

  // ── Bhavya unlinks: the link and its notes go from her phone ───────────────────────────────────────────────────
  await open(bhavya.page, "nav.profile", kn);
  await colleaguesOn(bhavya)
    .getByRole("button", { name: new RegExp(ashaName) })
    .click();
  await bhavya.page.getByRole("button", { name: t(kn, "colleague.unlink") }).click();
  const unlink = bhavya.page.getByRole("dialog", { name: t(kn, "colleague.unlink") });
  await expect(unlink).toContainText(t(kn, "colleague.unlink_confirm", { name: ashaName }));
  await unlink.getByRole("button", { name: t(kn, "colleague.unlink") }).click();
  await expect(bhavya.page.getByText(t(kn, "colleague.empty"))).toBeVisible();
  await shoot("unlinked", shots, folder);
});

test("a worker hires a helper from Talk: the work site first, never their own card, then both sign", async ({
  browser,
}) => {
  const folder = "hire-helper";
  const [arun, chitra] = (await phones(browser, [en, en])) as [Phone, Phone];
  const shots = pagesOf({ hirer: arun, helper: chitra });
  const arunName = `Arun ${RUN}`;
  const chitraName = `Chitra ${RUN}`;
  const site = `Site 14, EPIP Zone, Whitefield (${RUN})`;

  await signIn(arun.page, { role: Role.worker, name: arunName, phone: newPhone() });
  await signIn(chitra.page, { role: Role.worker, name: chitraName, phone: newPhone() });
  // Both are electricians in Whitefield, so Arun's own card would be in his results if Find let it.
  await publishCard(arun, { trade: "Electrician", area: "whitefield", rate: "800", min: "600", about: "Wiring" });
  await publishCard(chitra, { trade: "Electrician", area: "whitefield", rate: "700", min: "500", about: "Fans" });

  // ── Talk's chip opens Find to hire; with no address on his card, it asks where the work is ───────────────────────
  await open(arun.page, "nav.talk");
  await arun.page.getByRole("button", { name: t(en, "hire.chip") }).click();
  await expect(arun.page.getByRole("heading", { name: t(en, "hire.title") })).toBeVisible();
  const siteForm = arun.page.getByRole("form", { name: t(en, "hire.site") });
  await expect(siteForm).toContainText(t(en, "hire.site_help"));
  await shoot("hire-asks-site", shots, folder);
  await siteForm.getByLabel(t(en, "hire.site")).fill(site);
  await siteForm.getByRole("button", { name: t(en, "hire.site_save") }).click();

  // Back leads to Talk, the tab Find was opened from; the chip opens Find again, straight to the search now.
  await arun.page.getByRole("button", { name: t(en, "a11y.back") }).click();
  await expect(tabs(arun.page).getByRole("button", { name: t(en, "nav.talk") })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await arun.page.getByRole("button", { name: t(en, "hire.chip") }).click();
  await fillAsk(arun, {
    trade: "electrician",
    area: "Whitefield",
    worker: chitraName,
    need: "Help pulling cable for a new flat",
    when: "when.tomorrow",
    budget: "700",
  });
  await expect(arun.page.getByLabel(t(en, "a11y.worker", { name: arunName }))).toHaveCount(0);
  await shoot("hire-search", shots, folder);
  await arun.page.getByRole("button", { name: plural(en, "find.ask", 1) }).click();

  // ── He follows the hire on Today, under You hired; Chitra's agent asks what is wrong and he answers there ───────
  await expect(tabs(arun.page).getByRole("button", { name: t(en, "nav.today") })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const hired = inSection(arun.page, "hire.section");
  const question = hired.getByRole("form", { name: t(en, "a11y.answer") });
  await expect(question).toBeVisible();
  await shoot("you-hired", shots, folder);
  await question.getByLabel(questionText(en, "problem")).fill("Cable through two rooms");
  await question.getByRole("button", { name: t(en, "job.send_answers") }).click();

  // Her decisions are on her Today, as any worker's are.
  await open(chitra.page, "nav.today");
  await signBoth({ hirer: arun, helper: chitra }, folder);
  // Signed: the helper gets the work site; the hirer gets the helper's card. Only now.
  await expect(chitra.page.getByLabel(t(en, "a11y.contact"))).toContainText(site);
  await expect(hired.getByLabel(t(en, "a11y.contact"))).toContainText(chitraName);
  await shoot("both-signed", shots, folder);

  // Profile shows the work site, where he can change it.
  await open(arun.page, "nav.profile");
  await expect(arun.page.getByRole("form", { name: t(en, "hire.site_profile") }).getByRole("textbox")).toHaveValue(
    site,
  );
});
