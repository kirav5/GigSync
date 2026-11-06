import { plural, questionText, t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import type { Page } from "@playwright/test";
import { newPhone, open, Role, RUN, signIn } from "./helpers.js";
import { fillAsk, type Phone, publishCard, signBoth } from "./journey.js";

const { en } = Lang.enum;
const say = (key: Parameters<typeof t>[1]) => t(en, key);

/** A carpenter in Jayanagar and a household there, both signed on one job; their names. */
export async function signedJob(workerPage: Page, householdPage: Page, tag: string, folder: string) {
  const worker: Phone = { page: workerPage, lang: en };
  const household: Phone = { page: householdPage, lang: en };
  const names = { worker: `Ganesh ${tag} ${RUN}`, household: `Lakshmi ${tag} ${RUN}` };
  await signIn(workerPage, { role: Role.worker, name: names.worker, phone: newPhone() });
  await publishCard(worker, {
    trade: t(en, "trade.carpenter"),
    area: "jayanagar",
    rate: "800",
    min: "600",
    about: "Doors and cupboards",
  });
  await open(workerPage, "nav.activity");
  await signIn(householdPage, {
    role: Role.consumer,
    name: names.household,
    phone: newPhone(),
    address: `No. 9, 4th Block (${tag} ${RUN})`,
    area: "Jayanagar",
  });
  await fillAsk(household, {
    trade: "carpenter",
    area: "Jayanagar",
    worker: names.worker,
    need: "Need a carpenter",
    when: "when.today",
    budget: "750",
  });
  await householdPage.getByRole("button", { name: plural(en, "find.ask", 1) }).click();
  const answer = householdPage.getByRole("form", { name: say("a11y.answer") });
  await answer.getByLabel(questionText(en, "problem")).fill("Cupboard door hangs loose");
  await answer.getByRole("button", { name: say("job.send_answers") }).click();
  await signBoth({ worker, household }, folder);
  return names;
}
