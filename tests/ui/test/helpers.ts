import { mkdirSync } from "node:fs";
import { ApiClient, Header, type MessageKey, type Params, type PluralKey, SecretKeys, t } from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import { DEFAULT_LANG, type Lang, type Place, type Trade } from "@gigsync/protocol";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { open } from "./menu.js";

/** The app's frame, as the specs reach it (menu.ts): the menu, its screens, the chat, sign-out and My card's form. */
export * from "./menu.js";

export const API = process.env.API_BASE ?? "http://localhost:8787";
/** The app as the dev server serves it; absolute, so pages without a base URL (a phone over DevTools) work too. */
export const APP = process.env.APP_URL ?? "http://localhost:5173";
const DEV_OTP = process.env.DEV_OTP ?? "000000";
/** The API's sign-in rate window (OTP_RATE_LIMIT in workers/api/wrangler.toml), plus a second. */
const RATE_WINDOW_MS = 61_000;
export const SHOTS = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

/** This run's tag, so names and numbers never collide with an earlier run in the shared directory. */
export const RUN = String(Date.now()).slice(-5);
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
export const newPhone = () => `+9198${digits(8)}`;

export const Role = { consumer: "consumer", worker: "worker" } as const;
type Role = (typeof Role)[keyof typeof Role];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PLACEHOLDER = /\{(\w+)\}/;
const COUNT = "count";

/** A catalog string as a regular expression's source; `fill` gives a placeholder's pattern, anything else matches. */
function sourceOf(lang: Lang, key: MessageKey, fill: (name: string) => string | undefined): string {
  // split() with a capture group alternates text and placeholder names.
  return t(lang, key)
    .split(PLACEHOLDER)
    .map((part, i) => (i % 2 === 0 ? escapeRe(part) : (fill(part) ?? ".+?")))
    .join("");
}

/** A catalog string as a pattern: the params given are filled in, any other placeholder matches anything. */
export function textOf(lang: Lang, key: MessageKey, params: Params = {}): RegExp {
  return new RegExp(sourceOf(lang, key, (name) => (name in params ? escapeRe(String(params[name])) : undefined)));
}

/** Every count of plural strings, as a fold's summary shows them ("Your agent is talking with 2 customers"). */
export function counted(lang: Lang, ...keys: PluralKey[]): RegExp {
  const forms = keys.flatMap((k) => [`${k}.one`, `${k}.other`] as const);
  const count = (name: string) => (name === COUNT ? "\\d+" : undefined);
  return new RegExp(forms.map((f) => `(?:${sourceOf(lang, f, count)})`).join("|"));
}

/** Picks a language on the first screen, by its name in its own script, then continues in it. */
export async function chooseLanguage(page: Page, lang: Lang) {
  await page.goto(APP);
  await page.getByRole("radio", { name: new RegExp(`^${escapeRe(t(lang, `lang.${lang}`))}`) }).check();
  await page.getByRole("button", { name: t(lang, "onboard.continue") }).click();
}

/** Someone signing in: their role, name, number, address (households only) and language. */
interface Person {
  role: Role;
  name: string;
  phone: string;
  address?: string;
  lang?: Lang;
}

/** Signs in through the app's own screens, in the person's language: language first, then role, name, number, code. */
export async function signIn(page: Page, who: Person) {
  await chooseLanguage(page, who.lang ?? DEFAULT_LANG);
  await completeSignIn(page, who);
}

/**
 * Fills the sign-in screen already showing and signs in. The fields are in the form; its buttons are in the dock below
 * it, so they are found on the page.
 */
export async function completeSignIn(page: Page, who: Person) {
  const lang = who.lang ?? DEFAULT_LANG;
  const form = page.getByRole("form", { name: t(lang, "signin.label") });
  await form.getByRole("radio", { name: t(lang, `signin.${who.role}`) }).click();
  await form.getByLabel(t(lang, "signin.name")).fill(who.name);
  await form.getByLabel(t(lang, "signin.phone")).fill(who.phone);
  if (who.address) await form.getByLabel(t(lang, "signin.address")).fill(who.address);
  await page.getByRole("button", { name: t(lang, "signin.send_code"), exact: true }).click();
  await form.getByLabel(new RegExp(`^${escapeRe(t(lang, "signin.code"))}`)).fill(DEV_OTP);
  const submit = page.getByRole("button", { name: t(lang, "signin.submit"), exact: true });
  await submit.click();
  // The API lets one network address check 10 codes a minute, and a test run signs many people in from one machine:
  // when it says so, wait the minute out and try the same code again.
  const tooMany = page.getByText(t(lang, "net.too_many"));
  // Signed in, the top bar shows (only the signed-in frame has one), whichever screen opened first.
  await expect(page.getByRole("banner").or(tooMany)).toBeVisible();
  if (await tooMany.isVisible()) {
    await page.waitForTimeout(RATE_WINDOW_MS);
    await submit.click();
  }
  await expect(page.getByRole("banner")).toBeVisible();
}

/** Saves the worker's UPI ID in About me, the only place it is asked for; the name is left as the form fills it. */
export async function setUpi(page: Page, lang: Lang, vpa: string) {
  await open(page, "nav.about", lang);
  // A saved UPI ID is one line: Change opens the form again.
  const change = page.getByRole("button", { name: t(lang, "settings.change"), exact: true });
  if (await change.isVisible()) await change.click();
  const form = page.getByRole("form", { name: t(lang, "settings.paid_to") });
  await form.getByLabel(t(lang, "settings.vpa"), { exact: true }).fill(vpa);
  await form.getByRole("button", { name: t(lang, "settings.save"), exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: t(lang, "settings.saved") })).toBeVisible();
}

/** What the fake engine pretends about this phone besides hearing: no mode is an on-device recognizer. */
export const FakeSpeechMode = { cloud: "cloud", none: "none" } as const;
type FakeSpeechMode = (typeof FakeSpeechMode)[keyof typeof FakeSpeechMode];

/**
 * Dev builds only: each tap on the mic hears the next of `answers` (apps/mobile/src/adapters/speech-fake.ts). "cloud"
 * says the phone has no on-device recognizer but a cloud one from Google, so the consent sheet shows. Written once per
 * tab, so a reload keeps whatever the engine has not heard yet.
 */
export async function fakeSpeech(page: Page, answers: readonly string[], mode?: FakeSpeechMode) {
  await page.addInitScript(
    ({ answers, mode }) => {
      const SEEDED = "gigsync-fake-speech-seeded";
      if (sessionStorage.getItem(SEEDED)) return;
      sessionStorage.setItem(SEEDED, "1");
      localStorage.setItem("gigsync-fake-speech", JSON.stringify(answers));
      if (mode) localStorage.setItem("gigsync-fake-speech-mode", mode);
      else localStorage.removeItem("gigsync-fake-speech-mode");
    },
    { answers, mode },
  );
}

/** A browser with no speech recognition at all, on the device or in the cloud: the mic must say "please type". */
export async function noSpeech(page: Page) {
  await page.addInitScript(() => {
    for (const name of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      Reflect.deleteProperty(globalThis, name);
      if (name in globalThis) Object.defineProperty(globalThis, name, { value: undefined, configurable: true });
    }
  });
}

/** Opens the folded sections (Earlier, Details, the agents' talks) whose summary reads `summary`, inside `scope`. */
export async function expand(scope: Page | Locator, summary: MessageKey | RegExp, lang: Lang = DEFAULT_LANG) {
  const text = summary instanceof RegExp ? summary : t(lang, summary);
  await expect(scope.locator("summary").filter({ hasText: text }).first()).toBeVisible();
  for (const closed of await scope.locator("details:not([open]) > summary").filter({ hasText: text }).all()) {
    await closed.click();
  }
}

/**
 * Waits for `target` while the job may still move: a paid one-off job goes to Earlier, a job waiting on the other side
 * to the agents' talks. Each try opens every folded section first.
 */
export async function reveal(page: Page, target: Locator) {
  await expect(async () => {
    await page.locator("details:not([open])").evaluateAll((folds) => {
      for (const fold of folds) if (fold instanceof HTMLDetailsElement) fold.open = true;
    });
    await expect(target).toBeVisible({ timeout: 2_000 });
  }).toPass();
}

/**
 * The job cards under one heading of Today or My jobs: those whose nearest section heading above is `heading`. Cards in
 * a fold (Earlier, the agents' talks) are never under a heading.
 */
export function inSection(page: Page, heading: MessageKey, lang: Lang = DEFAULT_LANG): Locator {
  const title = t(lang, heading);
  const nearest = "preceding::*[self::h1 or self::h2 or self::h3][not(ancestor::article)][1]";
  return page.locator(
    `xpath=//article[not(ancestor::details)][${nearest}[starts-with(normalize-space(.), "${title}")]]`,
  );
}

/**
 * Pages shot at screen size: a full-page capture of a phone's web view sends a large image over the emulator's adb
 * link, which has reset mid-run under that load.
 */
export const screenSizeShots = new WeakSet<Page>();

const steps = new Map<string, number>();
/** Saves both phones' screens for one step of the journey, side by side by name, in a folder per browser and test. */
export async function shoot(label: string, phones: Record<string, Page>, folder = "") {
  const info = test.info();
  const step = (steps.get(info.testId) ?? 0) + 1;
  steps.set(info.testId, step);
  const n = String(step).padStart(2, "0");
  const dir = `${SHOTS}${info.project.name}/${folder ? `${folder}/` : ""}`;
  for (const [who, page] of Object.entries(phones)) {
    // Let transitions finish, but never wait on an endless one.
    await page.evaluate(() =>
      Promise.race([
        Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
        new Promise((done) => setTimeout(done, 1000)),
      ]),
    );
    await page.screenshot({ path: `${dir}${n}-${label}-${who}.png`, fullPage: !screenSizeShots.has(page) });
  }
}

/** Lists a worker straight through the API, for a fuller board; nobody asks them in this test. */
export async function listWorker(
  name: string,
  trades: Trade[],
  area: Place,
  ratePaise: number,
  where: { area_name: string; languages: string[] } = { area_name: "Indiranagar", languages: ["kn", "en"] },
): Promise<ApiClient> {
  const keys = new SecretKeys(newDeviceSecrets());
  const ip = `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const anon = new ApiClient(API, (input, init) =>
    fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), [Header.cfConnectingIp]: ip } }),
  );
  const session = await anon.verifyOtp(newPhone(), DEV_OTP, { ...(await keys.publicKeys()), protocol: 1 });
  const api = anon.as(session);
  await api.publishProfile({
    display_name: name,
    trades,
    area,
    rate_paise: ratePaise,
    ...where,
    about: "Listed by the UI test",
  });
  return api;
}
