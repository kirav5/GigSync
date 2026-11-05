import { type MessageKey, plural, t } from "@gigsync/core";
import { Lang, MENTOR_MIN_JOBS, MENTOR_MIN_MONTHS } from "@gigsync/protocol";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";
import { newPhone, open, Role, RUN, shoot, signIn } from "./helpers.js";
import { type Phone, publishCard, unlistCards } from "./journey.js";
import { type Party, seedMentorLink, seedRecord } from "./mentor-seed.js";
import { type } from "./talk.js";

/**
 * Mentors without a gate (round4-spec §2) through the app's real screens. A worker whose own phone counts enough
 * signed work offers to help newcomers in Talk and answers the listing's questions there; a newcomer says in Talk she
 * is moving, asks to find someone who knows the city, says she is a woman (women-only turns on), asks her, reads the
 * safety words and says when she arrives; the mentor helps from Today; the newcomer accepts on Today and a 30-day
 * mentor link opens, with renew, report and block. Then an introduction: someone linked with two people introduces them, nothing scanned.
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

const city = (lang: Lang) => t(lang, `mentor.city.${CITY}`);
const statusOn = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
/** What each language says in Talk to offer help to newcomers, and to stop. */
const OFFER: Readonly<Record<Lang, string>> = {
  [en]: "I can help people new to Bengaluru",
  [hi]: "मैं बेंगलुरु में नए लोगों की मदद कर सकती हूँ",
  [kn]: "ಬೆಂಗಳೂರಿಗೆ ಹೊಸಬರಿಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ",
};
const STOP: Readonly<Record<Lang, string>> = {
  [en]: "stop helping newcomers",
  [hi]: "नए लोगों की मदद बंद करो",
  [kn]: "ಹೊಸಬರಿಗೆ ಸಹಾಯ ನಿಲ್ಲಿಸಿ",
};

/** Taps a chip in Talk's conversation by its words in the owner's language. */
const tap = ({ page, lang }: Phone, key: MessageKey, params = {}) =>
  page
    .getByRole("log")
    .getByRole("button", { name: t(lang, key, params), exact: true })
    .last()
    .click();

/** Says "stop helping newcomers" in Talk, so no mentor from this run stays on the shared list. */
async function unlistMentors() {
  for (const m of listedMentors.splice(0)) {
    if (m.page.isClosed()) continue;
    try {
      await open(m.page, "nav.talk", m.lang);
      await type(m.page, m.lang, STOP[m.lang]);
      await expect(m.page.getByText(t(m.lang, "moving.unlisted"))).toBeVisible({ timeout: 15_000 });
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

  // ── Asha's own record is too short: Talk says why, with her phone's count ───────────────────────────────────────
  await asha.page.getByRole("button", { name: t(hi, "iv.later"), exact: true }).click();
  await type(asha.page, hi, OFFER[hi]);
  await expect(asha.page.getByRole("log")).toContainText(
    t(hi, "moving.not_eligible", { min_months: MENTOR_MIN_MONTHS, min_jobs: MENTOR_MIN_JOBS, jobs: 0, months: 0 }),
  );

  // ── Lata's phone counts 30 signed jobs over 8 months: she offers in Talk and answers its questions, as a woman ──
  await seedRecord(lata.page, JOBS_DONE, DAYS_OF_WORK);
  await open(lata.page, "nav.talk", kn);
  await type(lata.page, kn, OFFER[kn]);
  await tap(lata, "area.koramangala");
  // She speaks Hindi too: newcomers who speak it can find her.
  await tap(lata, "lang.hi");
  await expect(lata.page.getByRole("button", { name: t(kn, "lang.hi"), exact: true }).last()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await tap(lata, "moving.done");
  await tap(lata, "mentor.yes");
  await expect(lata.page.getByRole("log")).toContainText(t(kn, "moving.list_women_only"));
  await tap(lata, "mentor.no");
  await tap(lata, "moving.slots", { n: 2 });
  await shoot("mentor-opts-in", shots, folder);
  await tap(lata, "moving.list_yes");
  listedMentors.push(lata);
  await expect(lata.page.getByText(t(kn, "mentor.listed", { city: city(kn) }))).toBeVisible();

  // ── Asha says she is moving and does cooking, then asks for someone who knows the city ─────────────────────────
  await type(asha.page, hi, "मैं अगले हफ़्ते बेंगलुरु शिफ्ट हो रही हूँ");
  await tap(asha, "trade.cook");
  await tap(asha, "moving.find");
  // "Are you a woman" once; women-only turns on.
  await tap(asha, "mentor.yes");
  const choose = asha.page.getByRole("button", { name: t(hi, "moving.ask", { name: lataName }) });
  await expect(choose).toBeVisible();
  const card = asha.page.getByRole("listitem").filter({ has: choose });
  await expect(card).toContainText(t(hi, "mentor.says", { jobs: JOBS_DONE, months: MONTHS_OF_WORK }));
  await expect(card).toContainText(t(hi, "mentor.own_count"));
  await choose.click();
  // The safety words first, once, before any contact.
  await expect(asha.page.getByRole("log")).toContainText(t(hi, "mentor.safety_money"));
  await shoot("safety-first", shots, folder);
  await tap(asha, "mentor.safety_ok");
  await tap(asha, "moving.arrive_1");
  await expect(asha.page.getByRole("log")).toContainText(t(hi, "moving.sent", { name: lataName }));
  await shoot("newcomer-picks", shots, folder);

  // ── Lata sees the request on Today and offers to help ──────────────────────────────────────────────────────────
  await open(lata.page, "nav.activity", kn);
  const help = lata.page.getByRole("button", { name: t(kn, "mentor.help", { name: ashaName }) });
  await expect(help).toBeVisible();
  await shoot("mentor-decides", shots, folder);
  await help.click();

  // ── Asha accepts on Today; the mentor link opens on both phones, for 30 days ───────────────────────────────────
  await open(asha.page, "nav.activity", hi);
  const accept = asha.page.getByRole("button", { name: t(hi, "mentor.accept_offer", { name: lataName }) });
  await expect(accept).toBeVisible();
  await shoot("offer", shots, folder);
  await accept.click();
  await open(asha.page, "nav.privacy", hi);
  const ashaRow = asha.page.getByRole("button", { name: new RegExp(lataName) });
  await expect(ashaRow).toContainText(t(hi, "mentor.chip"));
  await expect(ashaRow).toContainText(plural(hi, "mentor.days_left", 30));
  await open(lata.page, "nav.privacy", kn);
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

/** Profile's mentor links, in the owner's language. */
const linksOn = ({ page, lang }: Phone) => page.getByRole("region", { name: t(lang, "mentor.links") });

/** On Today: the introduction's safety words, then Meet. */
async function meet(p: Phone, name: string) {
  await open(p.page, "nav.activity", p.lang);
  const intros = p.page.getByRole("region", { name: t(p.lang, "mentor.intros") });
  await intros.getByRole("button", { name: t(p.lang, "mentor.safety_ok") }).click();
  await intros.getByRole("button", { name: t(p.lang, "mentor.intro_meet", { name }) }).click();
}

test("a worker linked with two people introduces them, both say yes, and a mentor link opens", async ({ browser }) => {
  const folder = "mentor-intro";
  const [suresh, asha, mukesh] = (await phones(browser, [en, hi, kn])) as [Phone, Phone, Phone];
  const shots = { introducer: suresh.page, newcomer: asha.page, mentor: mukesh.page };
  const parties: Record<string, Party> = {
    suresh: { page: suresh.page, name: `Suresh ${RUN}`, phone: newPhone() },
    asha: { page: asha.page, name: `Asha ${RUN}`, phone: newPhone() },
    mukesh: { page: mukesh.page, name: `Mukesh ${RUN}`, phone: newPhone() },
  };
  const { suresh: s, asha: a, mukesh: m } = parties as Record<"suresh" | "asha" | "mukesh", Party>;
  await signIn(suresh.page, { role: Role.worker, name: s.name, phone: s.phone, lang: en });
  await signIn(asha.page, { role: Role.worker, name: a.name, phone: a.phone, lang: hi });
  await signIn(mukesh.page, { role: Role.worker, name: m.name, phone: m.phone, lang: kn });
  // Suresh has a mentor link with Asha (now moving to Bengaluru) and one with Mukesh (who works there).
  await seedMentorLink(s, a);
  await seedMentorLink(s, m);

  // ── Suresh introduces Mukesh to her from their link ────────────────────────────────────────────────────────────
  await open(suresh.page, "nav.privacy", en);
  await linksOn(suresh)
    .getByRole("button", { name: new RegExp(a.name) })
    .click();
  await suresh.page.getByRole("button", { name: t(en, "mentor.introduce", { name: a.name }) }).click();
  await suresh.page.getByRole("button", { name: t(en, "mentor.intro_send", { name: m.name }) }).click();
  await expect(statusOn(suresh.page, t(en, "mentor.intro_sent", { name: a.name, other: m.name }))).toBeVisible();
  await shoot("introduced", shots, folder);

  // ── Each says yes on their own phone, after the safety words; the link opens on both ───────────────────────────
  await meet(asha, m.name);
  await expect(asha.page.getByText(t(hi, "mentor.intro_waiting", { name: m.name }))).toBeVisible();
  await meet(mukesh, a.name);
  await open(asha.page, "nav.privacy", hi);
  await expect(linksOn(asha).getByRole("button", { name: new RegExp(m.name) })).toContainText(t(hi, "mentor.chip"));
  await open(mukesh.page, "nav.privacy", kn);
  await expect(linksOn(mukesh).getByRole("button", { name: new RegExp(a.name) })).toContainText(
    t(kn, "mentor.chip_newcomer"),
  );
  await shoot("mentor-link", shots, folder);
});
