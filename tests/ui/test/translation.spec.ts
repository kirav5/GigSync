import { type ApiClient, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, test } from "@playwright/test";
import { listWorker, newPhone, Role, RUN, signIn } from "./helpers.js";
import { useSilentTranslator } from "./translator.js";

/**
 * When the phone's translator never answers (Chrome 156 headless leaves `Translator.availability()` pending), the
 * reader still gets the original, named by language, instead of a spinner that never ends.
 */

const { hi, kn } = Lang.enum;
const ABOUT = "उत्तर और दक्षिण भारतीय खाना";
let other: ApiClient | undefined;

test.afterEach(async () => {
  await other?.removeProfile();
});

test("a translator that never answers falls back to the original, labelled, within seconds", async ({ browser }) => {
  const context = await browser.newContext();
  await useSilentTranslator(context);
  const page = await context.newPage();
  const name = `Kavya ${RUN}`;
  other = await listWorker(name, ["cook"], { lat: 12.9116, lon: 77.6474 }, 900000, {
    area_name: "HSR Layout",
    languages: [hi],
  });
  // listWorker writes its own "about"; this worker's card says it in Hindi.
  await other.publishProfile({
    display_name: name,
    trades: ["cook"],
    area: { lat: 12.9116, lon: 77.6474 },
    area_name: "HSR Layout",
    rate_paise: 900000,
    languages: [hi],
    about: ABOUT,
  });

  await signIn(page, { role: Role.consumer, name: `Ravi ${RUN}`, phone: newPhone(), address: "HSR", lang: kn });
  const search = page.getByRole("form", { name: t(kn, "a11y.search") });
  await search.getByLabel(t(kn, "find.trade")).selectOption("cook");
  await search.getByLabel(t(kn, "find.area")).selectOption("HSR Layout");
  await search.getByRole("button", { name: t(kn, "find.search") }).click();
  const card = page.getByLabel(t(kn, "a11y.worker", { name }));
  await expect(card).toContainText(ABOUT);
  await expect(card).toContainText(t(kn, "said.cannot", { lang: t(kn, "lang.hi") }), { timeout: 10_000 });
  await context.close();
});
