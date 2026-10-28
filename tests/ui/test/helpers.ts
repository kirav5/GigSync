import { mkdirSync } from "node:fs";
import { ApiClient, Header, type MessageKey, SecretKeys, t } from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import { DEFAULT_LANG, type Lang, type Place, type Trade } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";

export const API = process.env.API_BASE ?? "http://localhost:8787";
/** The app as the dev server serves it; absolute, so pages without a base URL (a phone over DevTools) work too. */
export const APP = process.env.APP_URL ?? "http://localhost:5173";
const DEV_OTP = process.env.DEV_OTP ?? "000000";
export const SHOTS = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

/** This run's tag, so names and numbers never collide with an earlier run in the shared directory. */
export const RUN = String(Date.now()).slice(-5);
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
export const newPhone = () => `+9198${digits(8)}`;

export const Role = { consumer: "consumer", worker: "worker" } as const;
type Role = (typeof Role)[keyof typeof Role];

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Picks a language on the first screen, by its name in its own script. */
export async function chooseLanguage(page: Page, lang: Lang) {
  await page.goto(APP);
  await page.getByRole("button", { name: t(lang, `lang.${lang}`), exact: true }).click();
}

/** Signs in through the app's own screens, in the person's language: language first, then role, name, number, code. */
export async function signIn(
  page: Page,
  who: { role: Role; name: string; phone: string; address?: string; lang?: Lang },
) {
  const lang = who.lang ?? DEFAULT_LANG;
  await chooseLanguage(page, lang);
  const form = page.getByRole("form", { name: t(lang, "signin.label") });
  await form.getByRole("radio", { name: t(lang, `signin.${who.role}`) }).click();
  await form.getByLabel(t(lang, "signin.name")).fill(who.name);
  await form.getByLabel(t(lang, "signin.phone")).fill(who.phone);
  if (who.address) await form.getByLabel(t(lang, "signin.address")).fill(who.address);
  await form.getByRole("button", { name: t(lang, "signin.send_code") }).click();
  await form.getByLabel(new RegExp(`^${escapeRe(t(lang, "signin.code"))}`)).fill(DEV_OTP);
  await form.getByRole("button", { name: t(lang, "signin.submit") }).click();
  await expect(page.getByText(`${who.name} ·`)).toBeAttached();
}

/** Opens a screen from the menu (the menu slides in on a phone-sized window), named in the person's language. */
export async function open(page: Page, screen: MessageKey, lang: Lang = DEFAULT_LANG) {
  await page.getByRole("button", { name: t(lang, "a11y.open_menu") }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: t(lang, screen) })
    .click();
}

const steps = new Map<string, number>();
/** Saves both phones' screens for one step of the journey, side by side by name, in a folder per browser and test. */
export async function shoot(label: string, phones: Record<string, Page>, folder = "") {
  const info = test.info();
  const step = (steps.get(info.testId) ?? 0) + 1;
  steps.set(info.testId, step);
  const n = String(step).padStart(2, "0");
  const dir = `${SHOTS}${info.project.name}/${folder ? `${folder}/` : ""}`;
  for (const [who, page] of Object.entries(phones)) {
    // Let the menu's slide and other transitions finish, but never wait on an endless one.
    await page.evaluate(() =>
      Promise.race([
        Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))),
        new Promise((done) => setTimeout(done, 1000)),
      ]),
    );
    await page.screenshot({ path: `${dir}${n}-${label}-${who}.png`, fullPage: true });
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
