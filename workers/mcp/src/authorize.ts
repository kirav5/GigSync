import { HttpMethod } from "@gigsync/core/http";
import { log, pii } from "@gigsync/core/log";
import { Phone } from "@gigsync/protocol";
import { ApiFailure, requestCode, signIn } from "./api.js";
import type { Env, Props } from "./env.js";
import { APPROVE, codePage, consentPage, phonePage, problemPage, Step } from "./pages.js";

/**
 * GET and POST /authorize (ADR 0068): the person proves their number the way the app does, then says what the
 * assistant may do. The authorization request stays in the URL, so every step re-parses and re-checks it; between the
 * code and the consent, the API's connector token waits in KV under the consent handle, never in the page.
 */

/** How long a signed-in person has to answer the consent page; the consent handle lasts ten minutes too. */
const PENDING_TTL_S = 600;
const PENDING = "pending:";
/** Ten digits typed without a country code are an Indian number. */
const LOCAL_NUMBER = /^\d{10}$/;
const INDIA = "+91";
const SPACING = /[\s()-]/g;

const html = (body: string, headers = new Headers(), status = 200) => {
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(body, { status, headers });
};

function phoneFrom(typed: string): string | undefined {
  const plain = typed.replace(SPACING, "");
  const parsed = Phone.safeParse(LOCAL_NUMBER.test(plain) ? `${INDIA}${plain}` : plain);
  return parsed.success ? parsed.data : undefined;
}

/** Plain words for the API's refusals; anything else is a generic failure. */
function sayFailure(err: unknown): string {
  if (!(err instanceof ApiFailure)) return "GigSync could not be reached. Try again.";
  if (err.status === 404) return "No GigSync account uses this number. Join in the GigSync app first.";
  if (err.status === 401) return "That code is not right. Try again.";
  if (err.status === 429) return "Too many tries. Wait a few minutes and try again.";
  if (err.status === 503) return "Sign-in by SMS is not ready for connected assistants yet.";
  return "Something went wrong. Try again.";
}

async function onPhone(env: Env, form: FormData): Promise<Response> {
  const phone = phoneFrom(String(form.get("phone") ?? ""));
  if (!phone) return html(phonePage("Enter a phone number like +91 98xxxxxxxx."));
  try {
    await requestCode(env.API_ORIGIN, phone);
  } catch (err) {
    return html(phonePage(sayFailure(err)));
  }
  return html(codePage(phone));
}

async function onCode(request: Request, env: Env, form: FormData): Promise<Response> {
  const phone = phoneFrom(String(form.get("phone") ?? ""));
  const code = String(form.get("code") ?? "").trim();
  if (!phone) return html(phonePage());
  const oauth = env.OAUTH_PROVIDER;
  const authRequest = await oauth.parseAuthRequest(request);
  let props: Props;
  try {
    const session = await signIn(env.API_ORIGIN, { phone, code });
    props = { user: session.user, apiToken: session.token };
  } catch (err) {
    log.warn("connector sign-in failed", { phone: pii(phone), error: err instanceof Error ? err.message : "" });
    return html(codePage(phone, sayFailure(err)));
  }
  const details = await oauth.describeConsent(authRequest);
  const consent = await oauth.beginConsent(authRequest);
  await env.OAUTH_KV.put(`${PENDING}${consent.handle}`, JSON.stringify(props), { expirationTtl: PENDING_TTL_S });
  return html(consentPage(details, consent.handle), consent.headers);
}

async function onConsent(request: Request, env: Env, form: FormData): Promise<Response> {
  const oauth = env.OAUTH_PROVIDER;
  const handle = String(form.get("handle") ?? "");
  const key = `${PENDING}${handle}`;
  const pending = await env.OAUTH_KV.get<Props>(key, "json");
  await env.OAUTH_KV.delete(key);
  if (form.get("decision") !== APPROVE || !pending) {
    const denied = await oauth.denyConsent(request, handle);
    return new Response(null, { status: 302, headers: denied.headers });
  }
  const approved = await oauth.approveConsent(request, handle);
  const { redirectTo } = await oauth.completeAuthorization({
    request: approved.request,
    userId: pending.user,
    metadata: {},
    scope: approved.request.scope,
    props: pending,
  });
  log.info("connector authorized", { user: pending.user });
  approved.headers.set("location", redirectTo);
  return new Response(null, { status: 302, headers: approved.headers });
}

export async function authorize(request: Request, env: Env): Promise<Response> {
  try {
    // A bad or unknown client is shown here, never redirected to.
    await env.OAUTH_PROVIDER.parseAuthRequest(request);
    if (request.method !== HttpMethod.post) return html(phonePage());
    const form = await request.formData();
    const step = form.get("step");
    if (step === Step.phone) return await onPhone(env, form);
    if (step === Step.code) return await onCode(request, env, form);
    if (step === Step.consent) return await onConsent(request, env, form);
    return html(phonePage());
  } catch (err) {
    log.warn("authorize failed", { error: err instanceof Error ? err.name : "unknown" });
    return html(
      problemPage("This sign-in link is not valid any more. Start again from your assistant."),
      undefined,
      400,
    );
  }
}
