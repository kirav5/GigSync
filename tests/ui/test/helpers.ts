import { mkdirSync } from "node:fs";
import { ApiClient, Header, SecretKeys, t } from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import { DEFAULT_LANG, type Lang, type Place, type Trade } from "@gigsync/protocol";
import { expect, type Page, test } from "@playwright/test";

export const API = process.env.API_BASE ?? "http://localhost:8787";
const DEV_OTP = process.env.DEV_OTP ?? "000000";
export const SHOTS = new URL("../screenshots/", import.meta.url).pathname;
mkdirSync(SHOTS, { recursive: true });

/** This run's tag, so names and numbers never collide with an earlier run in the shared directory. */
export const RUN = String(Date.now()).slice(-5);
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
export const newPhone = () => `+9198${digits(8)}`;

export const Role = { consumer: "I need work done", worker: "I do the work" } as const;

/** Signs in through the app's own screen: role, language (named in itself), name, number, code. */
export async function signIn(
  page: Page,
  who: { role: string; name: string; phone: string; address?: string; lang?: Lang },
) {
  const lang = who.lang ?? DEFAULT_LANG;
  await page.goto("/");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByRole("radio", { name: who.role }).click();
  await form.getByRole("radio", { name: t(lang, `lang.${lang}`) }).click();
  await form.getByLabel("Your name").fill(who.name);
  await form.getByLabel("Mobile number").fill(who.phone);
  if (who.address) await form.getByLabel(/^Address/).fill(who.address);
  await form.getByRole("button", { name: "Send code" }).click();
  await form.getByLabel(/^Code from SMS/).fill(DEV_OTP);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(`${who.name} ·`)).toBeAttached();
}

/** Opens a screen from the menu (the menu slides in on a phone-sized window). */
export async function open(page: Page, screen: string) {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation").getByRole("button", { name: screen }).click();
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
