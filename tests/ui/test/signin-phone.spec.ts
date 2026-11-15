import { t } from "@gigsync/core";
import { Lang } from "@gigsync/protocol";
import { expect, type Route, test } from "@playwright/test";
import {
  API,
  chooseLanguage,
  completeSignIn,
  DEV_OTP,
  newPhone,
  Role,
  RUN,
  shell,
  shoot,
  signOutHere,
} from "./helpers.js";

/** People type their mobile number the way they say it: ten digits, no country code. */
const { en, hi } = Lang.enum;
const FOLDER = "signin";
const UNAUTHORIZED = 401;
/** The app and the API are on different ports: the refusal must pass CORS to reach the app as a 401. */
const ANY_ORIGIN = { "access-control-allow-origin": "*" };
/** Every signed-in API call; sign-in's own routes are under /v1/auth and stay open. */
const SIGNED_IN_CALLS = (url: URL) => url.href.startsWith(`${API}/v1/`) && !url.pathname.startsWith("/v1/auth/");
/** The API's sign-out (ApiPath.signOut in core, not exported to the specs). */
const SIGN_OUT_PATH = "/v1/me/signout";
/** "+919811122233" as the number field shows it: "98111 22233". */
const typedFrom = (e164: string) => `${e164.slice(3, 8)} ${e164.slice(8)}`;

test("sign-in takes a 10-digit number as typed, caps it, and says so plainly when a number cannot be a mobile", async ({
  page,
}) => {
  await chooseLanguage(page, hi);
  const form = page.getByRole("form", { name: t(hi, "signin.label") });
  // The welcome, then the number, the only field: find work or find help and the name come after the code.
  await page.getByRole("button", { name: t(hi, "start.welcome_go"), exact: true }).click();
  await form.getByLabel(t(hi, "signin.phone")).fill("12345");
  await page.getByRole("button", { name: t(hi, "signin.send_code"), exact: true }).click();
  await expect(page.getByText(t(hi, "signin.err_phone"))).toBeVisible();
  // Never more digits than an Indian mobile has; a pasted +91 or 0 is dropped and the rest grouped five and five.
  const field = form.getByLabel(t(hi, "signin.phone"));
  await field.fill("+91 98111 22233 999");
  await expect(field).toHaveValue("98111 22233");
  // Indian mobiles start with 6, 7, 8 or 9: a landline-looking number is caught before an SMS is spent.
  await field.fill("5811122233");
  await page.getByRole("button", { name: t(hi, "signin.send_code"), exact: true }).click();
  await expect(page.getByText(t(hi, "signin.err_phone"))).toBeVisible();

  // "98xxxxxxxx" with a space, as people write it: the app adds +91 itself.
  const tenDigits = newPhone().slice(3);
  const typed = `${tenDigits.slice(0, 5)} ${tenDigits.slice(5)}`;
  await completeSignIn(page, {
    role: Role.consumer,
    name: `Phone ${RUN}`,
    phone: typed,
    lang: hi,
  });
  await expect(shell(page, hi)).toBeVisible();
  // Signed in stays signed in: a reload, as an app restart, opens the same account, not sign-in.
  await page.reload();
  await expect(shell(page, hi)).toBeVisible();
  await expect(form).toHaveCount(0);
});

test("a session the server stopped taking opens sign-in on the same number, and the code goes straight back in", async ({
  page,
}) => {
  await chooseLanguage(page, en);
  const phone = newPhone();
  const who = { role: Role.worker, name: `Again ${RUN}`, phone, lang: en };
  await completeSignIn(page, who);
  await expect(shell(page, en)).toBeVisible();

  // The server forgets the session (as the test database does when its API restarts): every signed-in call is 401.
  const refused = (route: Route) =>
    route.fulfill({ status: UNAUTHORIZED, headers: ANY_ORIGIN, json: { error: "unauthorized" } });
  await page.route(SIGNED_IN_CALLS, refused);
  await page.reload();
  const form = page.getByRole("form", { name: t(en, "signin.label") });
  const number = form.getByLabel(t(en, "signin.phone"));
  await expect(number).toBeVisible();
  await expect(number).toHaveValue(typedFrom(phone));
  await expect(page.getByText(t(en, "start.signin_again"))).toBeVisible();
  await shoot("signin-again", { phone: page }, FOLDER);

  // Even after another reload the number waits there; then the code signs in with the side and name it had.
  await page.unroute(SIGNED_IN_CALLS, refused);
  await page.reload();
  await expect(number).toHaveValue(typedFrom(phone));
  await page.getByRole("button", { name: t(en, "signin.send_code"), exact: true }).click();
  await form.getByLabel(t(en, "signin.code"), { exact: true }).fill(DEV_OTP);
  await expect(shell(page, en)).toBeVisible();
  await expect(form.getByRole("radio")).toHaveCount(0);

  // Signing out on purpose with a session the server already refuses is a plain sign-out, never "Sign in again".
  const signOutCall = (url: URL) => url.pathname === SIGN_OUT_PATH;
  await page.route(signOutCall, refused);
  await signOutHere(page, en);
  await expect(page.getByRole("button", { name: t(en, "start.welcome_go"), exact: true })).toBeVisible();
  await expect(page.getByText(t(en, "start.signin_again"))).toHaveCount(0);
});
