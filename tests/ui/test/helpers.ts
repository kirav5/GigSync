import { mkdirSync } from "node:fs";
import { ApiClient, Header, type MessageKey, type Params, type PluralKey, SecretKeys, t } from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import { type BoardProfile, DEFAULT_LANG, type Lang, type Place, type Trade } from "@gigsync/protocol";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { areaIn, saveAddress } from "./address.js";
import { open } from "./menu.js";

/** Job cards on Activity and Records, wherever a job is filed now (jobs.ts). */
export * from "./jobs.js";
/** The app's frame, as the specs reach it (menu.ts): the menu, its screens, the chat, sign-out and My card's form. */
export * from "./menu.js";

/** The app and the API (stack.ts); absolute, so pages without a base URL (a phone over DevTools) work too. */
import { API, APP } from "../stack.js";

export { API, APP };
export const DEV_OTP = process.env.DEV_OTP ?? "000000";
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

/**
 * "Moving from another phone?" (ADR 0037) comes after signing in on an empty phone with a number that is signed in on
 * another device too: `wait` leaves it on screen for the test, `not_now` answers it. Absent: the number is new here
 * and nowhere else, so it never shows.
 */
export const MovePrompt = { wait: "wait", notNow: "not_now" } as const;
export type MovePrompt = (typeof MovePrompt)[keyof typeof MovePrompt];

/** Someone signing in: their role, name, number, address (households only) and language. */
interface Person {
  role: Role;
  name: string;
  phone: string;
  /** Saved as the household's address after sign-in (ADR 0045), in `area` or the pilot area it names. */
  address?: string;
  /** The pilot area the saved address is in, by its English name, when the address does not name one. */
  area?: string;
  lang?: Lang;
  /** The number is signed in on another device too: what to do with the move prompt. */
  elsewhere?: MovePrompt;
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
  if (who.elsewhere) {
    const notNow = page.getByRole("button", { name: t(lang, "phone.in_not_now"), exact: true });
    await expect(notNow).toBeVisible();
    if (who.elsewhere === MovePrompt.notNow) await notNow.click();
    else return;
  }
  // No address at sign-in any more (ADR 0045): a household saves one, as it would from Settings.
  if (who.address) await saveAddress(page, lang, { house: who.address, area: who.area ?? areaIn(who.address) });
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

/**
 * What the fake engine pretends about this phone besides hearing: no mode is an on-device recognizer. "downloadable":
 * the recognizer and the voice come once fetched during a tap; "unfetchable": they are offered but never come.
 */
export const FakeSpeechMode = {
  cloud: "cloud",
  none: "none",
  downloadable: "downloadable",
  unfetchable: "unfetchable",
} as const;
export type FakeSpeechMode = (typeof FakeSpeechMode)[keyof typeof FakeSpeechMode];

/**
 * Dev builds only: each tap on the mic hears the next of `answers` (apps/mobile/src/adapters/speech-fake.ts). "cloud"
 * says the phone has no on-device recognizer but a cloud one from Google, so the consent sheet shows. Written once per
 * tab; a reload starts the answers again, and forgets what the engine fetched.
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

/** One fetch the fake engine was asked for: the locale, "listen" or "speak", and whether it came during a tap. */
export interface FakeFetch {
  lang: string;
  mode: string;
  tapped: boolean;
}

/** What the fake engine logged under `key`: its fetches ("gigsync-fake-speech-fetches") or what it read aloud. */
async function fakeLog<T>(page: Page, key: string): Promise<T[]> {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "[]"), key);
}
export const fakeFetches = (page: Page) => fakeLog<FakeFetch>(page, "gigsync-fake-speech-fetches");
export const fakeSaid = (page: Page) => fakeLog<string>(page, "gigsync-fake-speech-said");

/** A browser with no speech recognition at all, on the device or in the cloud: the mic must say "please type". */
export async function noSpeech(page: Page) {
  await page.addInitScript(() => {
    for (const name of ["SpeechRecognition", "webkitSpeechRecognition"]) {
      Reflect.deleteProperty(globalThis, name);
      if (name in globalThis) Object.defineProperty(globalThis, name, { value: undefined, configurable: true });
    }
  });
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
  arrangements?: BoardProfile["arrangements"],
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
    ...(arrangements ? { arrangements } : {}),
  });
  return api;
}

/** A job card's status tag (its words in the owner's language): the progress line's steps share some of its words. */
export const statusTag = (scope: Locator | Page, lang: Lang, key: MessageKey) =>
  scope.locator(".tag").filter({ hasText: new RegExp(`^${t(lang, key)}$`) });

/** One step of a job card's progress line (JobProgress.tsx), by its name. */
export const progressStep = (scope: Locator | Page, lang: Lang, key: MessageKey) =>
  scope
    .getByRole("list", { name: t(lang, "progress.title") })
    .getByRole("listitem")
    .filter({ hasText: t(lang, key) });
