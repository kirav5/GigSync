import { plural, t } from "@gigsync/core";
import { Lang, MENTOR_MIN_JOBS, MENTOR_MIN_MONTHS } from "@gigsync/protocol";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, shoot, signIn } from "./helpers.js";
import { type Phone, publishCard, unlistCards } from "./journey.js";
import { seedRecord } from "./mentor-seed.js";

/**
 * Mentors without a gate (round4-spec §2) through the app's real screens. A worker whose own phone counts enough
 * signed work lists herself in Profile; a newcomer reads the safety words, says she is a woman (women-only turns on),
 * picks her, and asks; the mentor helps from Today; the newcomer accepts and a 30-day mentor link opens, with renew,
 * report and block. Then an introduction: a colleague introduces two of his own colleagues, no code scanned.
 */

const { hi, kn, en } = Lang.enum;
/** Months of work the seeded record spans, and its job count: past the minimum, so the toggle is on offer. */
const DAYS_OF_WORK = 250;
const MONTHS_OF_WORK = 8;
const JOBS_DONE = 30;
const CITY = "bengaluru";

let contexts: BrowserContext[] = [];
/** Mentors listed in this test, to take off the shared list whatever happens. */
const listedMentors: Phone[] = [];

async function phones(browser: Browser, langs: Lang[]): Promise<Phone[]> {
  contexts = await Promise.all(langs.map(() => browser.newContext()));
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  return pages.map((page, i) => ({ page, lang: langs[i] as Lang }));
}

/** Profile's mentor section, in the owner's language. */
const mentorSection = ({ page, lang }: Phone) => page.getByRole("region", { name: t(lang, "mentor.offer_title") });
const city = (lang: Lang) => t(lang, `mentor.city.${CITY}`);
const statusOn = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });

/** Unticks "I can help people new to…" so no mentor from this run stays on the shared list. */
async function unlistMentors() {
  for (const m of listedMentors.splice(0)) {
    if (m.page.isClosed()) continue;
    try {
      await open(m.page, "nav.profile", m.lang);
      const toggle = mentorSection(m).getByRole("checkbox", {
        name: t(m.lang, "mentor.offer_toggle", { city: city(m.lang) }),
      });
      if (await toggle.isChecked()) await toggle.uncheck();
    } catch {
      // The page is gone or stuck; nothing more can be done from here.
    }
  }
}

test.afterEach(async () => {
  await unlistMentors();
  await unlistCards();
  await Promise.all(contexts.map((c) => c.close()));
  contexts = [];
});

test("a newcomer picks a woman mentor from the list, they link for 30 days, then she reports and blocks", async ({
  browser,
}) => {
  const folder = "mentor";
  const [lata, asha] = (await phones(browser, [kn, hi])) as [Phone, Phone];
  const shots = { mentor: lata.page, newcomer: asha.page };
  const lataName = `Lata${RUN}`;
  const ashaName = `Asha ${RUN}`;

  await signIn(lata.page, { role: Role.worker, name: lataName, phone: newPhone(), lang: kn });
  await signIn(asha.page, { role: Role.worker, name: ashaName, phone: newPhone(), lang: hi });
  await publishCard(lata, { trade: t(kn, "trade.cook"), area: "koramangala", rate: "9000", min: "8000", about: "ಊಟ" });

  // ── Asha's own record is too short: the toggle is off, with the reason ─────────────────────────────────────────
  await open(asha.page, "nav.profile", hi);
  const ashaToggle = mentorSection(asha).getByRole("checkbox");
  await expect(ashaToggle).toBeDisabled();
  await expect(mentorSection(asha)).toContainText(
    t(hi, "mentor.not_yet", { min_months: MENTOR_MIN_MONTHS, min_jobs: MENTOR_MIN_JOBS, jobs: 0, months: 0 }),
  );

  // ── Lata's phone counts 30 signed jobs over 8 months: she lists herself, as a woman ────────────────────────────
  await seedRecord(lata.page, JOBS_DONE, DAYS_OF_WORK);
  await open(lata.page, "nav.today", kn);
  await open(lata.page, "nav.profile", kn);
  const toggle = mentorSection(lata).getByRole("checkbox", { name: t(kn, "mentor.offer_toggle", { city: city(kn) }) });
  await expect(toggle).toBeEnabled();
  await toggle.check();
  // She speaks Hindi too: newcomers who speak it can find her.
  await mentorSection(lata)
    .getByRole("button", { name: t(kn, "lang.hi"), exact: true })
    .click();
  await mentorSection(lata)
    .getByRole("checkbox", { name: t(kn, "mentor.i_am_woman") })
    .check();
  await expect(mentorSection(lata).getByRole("checkbox", { name: t(kn, "mentor.only_women") })).toBeVisible();
  await shoot("mentor-opts-in", shots, folder);
  await mentorSection(lata)
    .getByRole("button", { name: t(kn, "mentor.publish") })
    .click();
  listedMentors.push(lata);
  await expect(statusOn(lata.page, t(kn, "mentor.listed", { city: city(kn) }))).toBeVisible();

  // ── Asha: safety words first, then "are you a woman" once; women-only turns on ─────────────────────────────────
  await mentorSection(asha)
    .getByRole("button", { name: t(hi, "mentor.find") })
    .click();
  const safety = asha.page.getByRole("region", { name: t(hi, "mentor.safety_title") });
  await expect(safety).toContainText(t(hi, "mentor.safety_money"));
  await shoot("safety-first", shots, folder);
  await safety.getByRole("button", { name: t(hi, "mentor.safety_ok") }).click();
  await asha.page.getByRole("button", { name: t(hi, "mentor.yes"), exact: true }).click();
  const womenOnly = asha.page.getByRole("checkbox", { name: t(hi, "mentor.women_only") });
  await expect(womenOnly).toBeChecked();
  await asha.page.getByRole("button", { name: t(hi, "trade.cook"), exact: true }).click();
  await asha.page.getByRole("button", { name: t(hi, "mentor.search") }).click();
  const choose = asha.page.getByRole("button", { name: t(hi, "mentor.choose", { name: lataName }) });
  await expect(choose).toBeVisible();
  const card = asha.page.getByRole("listitem").filter({ has: choose });
  await expect(card).toContainText(t(hi, "mentor.says", { jobs: JOBS_DONE, months: MONTHS_OF_WORK }));
  await expect(card).toContainText(t(hi, "mentor.own_count"));
  await choose.click();
  const sheet = asha.page.getByRole("form", { name: plural(hi, "mentor.ask", 1) });
  await sheet.getByLabel(t(hi, "mentor.arrival")).fill("2026-11-11");
  await sheet.getByLabel(t(hi, "mentor.area_near")).selectOption({ label: t(hi, "area.koramangala") });
  await sheet.getByLabel(t(hi, "mentor.note")).fill("मैं खाना बनाती हूँ");
  await shoot("newcomer-picks", shots, folder);
  await sheet.getByRole("button", { name: t(hi, "mentor.send") }).click();
  await expect(statusOn(asha.page, t(hi, "mentor.sent"))).toBeVisible();

  // ── Lata sees the request on Today and offers to help ──────────────────────────────────────────────────────────
  await open(lata.page, "nav.today", kn);
  const help = lata.page.getByRole("button", { name: t(kn, "mentor.help", { name: ashaName }) });
  await expect(help).toBeVisible();
  await shoot("mentor-decides", shots, folder);
  await help.click();

  // ── Asha accepts; the mentor link opens on both phones, for 30 days ────────────────────────────────────────────
  const accept = asha.page.getByRole("button", { name: t(hi, "mentor.accept_offer", { name: lataName }) });
  await expect(accept).toBeVisible();
  await shoot("offer", shots, folder);
  await accept.click();
  await open(asha.page, "nav.profile", hi);
  const ashaRow = asha.page.getByRole("button", { name: new RegExp(lataName) });
  await expect(ashaRow).toContainText(t(hi, "mentor.chip"));
  await expect(ashaRow).toContainText(plural(hi, "mentor.days_left", 30));
  await open(lata.page, "nav.profile", kn);
  await expect(lata.page.getByRole("button", { name: new RegExp(ashaName) })).toContainText(
    t(kn, "mentor.chip_newcomer"),
  );
  await shoot("linked", shots, folder);

  // ── Renew, then report and block from the link's thread: the link goes from both phones ────────────────────────
  await ashaRow.click();
  await asha.page.getByRole("button", { name: t(hi, "mentor.renew") }).click();
  await expect(statusOn(asha.page, t(hi, "mentor.renewed"))).toBeVisible();
  await asha.page.getByRole("button", { name: t(hi, "mentor.report"), exact: true }).click();
  const report = asha.page.getByRole("group", { name: t(hi, "mentor.report_title", { name: lataName }) });
  await report.getByLabel(t(hi, "mentor.reason.asked_money")).check();
  await report.getByRole("button", { name: t(hi, "mentor.report_send") }).click();
  await expect(statusOn(asha.page, t(hi, "mentor.reported"))).toBeVisible();
  await asha.page.getByRole("button", { name: t(hi, "mentor.block"), exact: true }).click();
  const block = asha.page.getByRole("dialog", { name: t(hi, "mentor.block") });
  await expect(block).toContainText(t(hi, "mentor.block_confirm", { name: lataName }));
  await shoot("block", shots, folder);
  await block.getByRole("button", { name: t(hi, "mentor.block") }).click();
  await expect(asha.page.getByRole("button", { name: new RegExp(lataName) })).toHaveCount(0);
  await expect(lata.page.getByRole("button", { name: new RegExp(ashaName) })).toHaveCount(0);
  await shoot("blocked", shots, folder);
});

/** Dev builds only: the colleague code's text, on its QR (screens/colleague/ShowCode.tsx). */
const INVITE = "data-invite";
const colleaguesOn = ({ page, lang }: Phone) => page.getByRole("region", { name: t(lang, "colleague.title") });

/** `shower` shows a colleague code and `scanner` pastes it (a test browser has no camera), as two workers who met. */
async function linkInPerson(shower: Phone, scanner: Phone, showerName: string) {
  await open(shower.page, "nav.profile", shower.lang);
  await colleaguesOn(shower)
    .getByRole("button", { name: t(shower.lang, "colleague.show_code") })
    .click();
  const code = (await shower.page.locator(`[${INVITE}]`).getAttribute(INVITE)) ?? "";
  await open(scanner.page, "nav.profile", scanner.lang);
  await colleaguesOn(scanner)
    .getByRole("button", { name: t(scanner.lang, "colleague.scan") })
    .click();
  const paste = scanner.page.getByRole("form", { name: t(scanner.lang, "colleague.paste") });
  await paste.getByRole("textbox").fill(code);
  await paste.getByRole("button", { name: t(scanner.lang, "colleague.link") }).click();
  const confirm = scanner.page.getByRole("dialog", {
    name: t(scanner.lang, "colleague.confirm", { name: showerName }),
  });
  await confirm.getByRole("button", { name: t(scanner.lang, "colleague.link") }).click();
  await expect(statusOn(scanner.page, t(scanner.lang, "colleague.linked", { name: showerName }))).toBeVisible();
}

/** Opens one colleague's thread from Profile. */
async function thread(p: Phone, name: string) {
  await open(p.page, "nav.profile", p.lang);
  await colleaguesOn(p)
    .getByRole("button", { name: new RegExp(name) })
    .click();
}

/** On Today: the introduction's safety words, then Meet. */
async function meet(p: Phone, name: string) {
  await open(p.page, "nav.today", p.lang);
  const intros = p.page.getByRole("region", { name: t(p.lang, "mentor.intros") });
  await intros.getByRole("button", { name: t(p.lang, "mentor.safety_ok") }).click();
  await intros.getByRole("button", { name: t(p.lang, "mentor.intro_meet", { name }) }).click();
}

test("a colleague introduces two people he knows, both say yes, and a mentor link opens with no code", async ({
  browser,
}) => {
  const folder = "mentor-intro";
  const [suresh, asha, mukesh] = (await phones(browser, [en, hi, kn])) as [Phone, Phone, Phone];
  const shots = { introducer: suresh.page, newcomer: asha.page, mentor: mukesh.page };
  const sureshName = `Suresh ${RUN}`;
  const ashaName = `Asha ${RUN}`;
  const mukeshName = `Mukesh ${RUN}`;
  await signIn(suresh.page, { role: Role.worker, name: sureshName, phone: newPhone(), lang: en });
  await signIn(asha.page, { role: Role.worker, name: ashaName, phone: newPhone(), lang: hi });
  await signIn(mukesh.page, { role: Role.worker, name: mukeshName, phone: newPhone(), lang: kn });
  await linkInPerson(suresh, asha, sureshName);
  await linkInPerson(suresh, mukesh, sureshName);

  // ── Asha asks Suresh whether he knows someone in Bengaluru: a note in his thread ───────────────────────────────
  await thread(asha, sureshName);
  await asha.page.getByRole("button", { name: t(hi, "mentor.intro_ask", { city: city(hi) }) }).click();
  await expect(statusOn(asha.page, t(hi, "mentor.intro_asked", { name: sureshName }))).toBeVisible();

  // ── Suresh introduces Mukesh to her from her thread ────────────────────────────────────────────────────────────
  await thread(suresh, ashaName);
  await expect(suresh.page.getByRole("list", { name: t(en, "a11y.notes") })).toBeVisible();
  await suresh.page.getByRole("button", { name: t(en, "mentor.introduce", { name: ashaName }) }).click();
  await suresh.page.getByRole("button", { name: t(en, "mentor.intro_send", { name: mukeshName }) }).click();
  await expect(statusOn(suresh.page, t(en, "mentor.intro_sent", { name: ashaName, other: mukeshName }))).toBeVisible();
  await shoot("introduced", shots, folder);

  // ── Each says yes on their own phone, after the safety words; the link opens on both ───────────────────────────
  await meet(asha, mukeshName);
  await expect(asha.page.getByText(t(hi, "mentor.intro_waiting", { name: mukeshName }))).toBeVisible();
  await meet(mukesh, ashaName);
  await open(asha.page, "nav.profile", hi);
  await expect(colleaguesOn(asha).getByRole("button", { name: new RegExp(mukeshName) })).toContainText(
    t(hi, "mentor.chip"),
  );
  await open(mukesh.page, "nav.profile", kn);
  await expect(colleaguesOn(mukesh).getByRole("button", { name: new RegExp(ashaName) })).toContainText(
    t(kn, "mentor.chip_newcomer"),
  );
  await shoot("mentor-link", shots, folder);
});
