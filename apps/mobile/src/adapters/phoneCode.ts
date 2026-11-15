import { HttpError, NetError, NetReason, PhoneSignInClient } from "@gigsync/core";
import type { DeviceRegistration, Session } from "@gigsync/protocol";
import type { FirebaseOptions } from "firebase/app";
import type { Auth, ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { API_BASE } from "./api.js";

/**
 * The SMS sign-in code. With Firebase set up in the build (VITE_FIREBASE_*), Firebase sends the SMS and checks the
 * code, and the API signs in with the ID token Firebase gives for the number; without it, the API's dev path
 * (`/otp/request`, `/otp/verify` with DEV_OTP), so local dev and the UI tests work as before. Firebase is loaded only
 * when a code is first sent, keeping it out of the main bundle, and keeps no session on the phone (in memory only).
 */

/** The build's Firebase web config, when all of it is set; the app id and keys are public, as in any Firebase web app. */
function firebaseOptions(): FirebaseOptions | undefined {
  const env = import.meta.env;
  const [apiKey, authDomain, projectId, appId] = [
    env.VITE_FIREBASE_API_KEY,
    env.VITE_FIREBASE_AUTH_DOMAIN,
    env.VITE_FIREBASE_PROJECT_ID,
    env.VITE_FIREBASE_APP_ID,
  ];
  return apiKey && authDomain && projectId && appId ? { apiKey, authDomain, projectId, appId } : undefined;
}

const UNAUTHORIZED = 401;
const BAD_REQUEST = 400;
const TOO_MANY = 429;
/** What the errors made here say; logged by the sign-in screen, never shown (it shows `errorKey`'s words). */
const Problem = {
  wrongCode: "wrong code",
  codeExpired: "code expired",
  tooMany: "too many attempts",
  quota: "sms quota exceeded",
  badPhone: "bad phone",
  noCodeSent: "no code sent",
} as const;

/**
 * Firebase's errors as the API's own answers, so the sign-in screen says the same thing either way (`errorKey`):
 * too many tries is "too many", no network is "offline", the rest a wrong code or number.
 */
const FIREBASE_ERROR: Readonly<Record<string, () => Error>> = {
  "auth/invalid-verification-code": () => new HttpError(UNAUTHORIZED, Problem.wrongCode),
  "auth/missing-verification-code": () => new HttpError(UNAUTHORIZED, Problem.wrongCode),
  "auth/code-expired": () => new HttpError(UNAUTHORIZED, Problem.codeExpired),
  "auth/too-many-requests": () => new HttpError(TOO_MANY, Problem.tooMany),
  "auth/quota-exceeded": () => new HttpError(TOO_MANY, Problem.quota),
  "auth/invalid-phone-number": () => new HttpError(BAD_REQUEST, Problem.badPhone),
  "auth/missing-phone-number": () => new HttpError(BAD_REQUEST, Problem.badPhone),
  "auth/network-request-failed": () => new NetError(NetReason.offline),
};

function fromFirebase(err: unknown): unknown {
  const code = err instanceof Error && "code" in err && typeof err.code === "string" ? err.code : undefined;
  const mapped = code === undefined ? undefined : FIREBASE_ERROR[code];
  return mapped ? mapped() : err;
}

async function withFirebaseErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    throw fromFirebase(err);
  }
}

/** The API's sign-in routes, or with a session its routes for proving a second number as that person. */
function signInClient(session?: Session): PhoneSignInClient {
  if (!API_BASE) throw new Error("No API address in this build");
  return new PhoneSignInClient(API_BASE, undefined, session);
}

/** Firebase Auth, made once per app run, keeping its session in memory: the API's session is the one that counts. */
let auth: Promise<{ auth: Auth; sdk: typeof import("firebase/auth") }> | undefined;

function firebaseAuth(options: FirebaseOptions) {
  auth ??= Promise.all([import("firebase/app"), import("firebase/auth")]).then(([app, sdk]) => {
    const made = sdk.initializeAuth(app.initializeApp(options), { persistence: sdk.inMemoryPersistence });
    sdk.useDeviceLanguage(made);
    return { auth: made, sdk };
  });
  return auth;
}

/** The code sent last, and the number it went to; a new send replaces it, so only the latest code signs in. */
let pending: { phone: string; confirmation: ConfirmationResult } | undefined;
/** The invisible reCAPTCHA Firebase needs before it sends an SMS, and the element it lives in; one per send. */
let captcha: { verifier: RecaptchaVerifier; box: HTMLElement } | undefined;

function freshCaptcha(sdk: typeof import("firebase/auth"), firebase: Auth): RecaptchaVerifier {
  captcha?.verifier.clear();
  captcha?.box.remove();
  const box = document.createElement("div");
  document.body.append(box);
  captcha = { verifier: new sdk.RecaptchaVerifier(firebase, box, { size: "invisible" }), box };
  return captcha.verifier;
}

/** Has Firebase send its code to `phone`; the latest send is the one a code is checked against. */
async function sendWithFirebase(options: FirebaseOptions, phone: string): Promise<void> {
  const { auth: firebase, sdk } = await firebaseAuth(options);
  const confirmation = await withFirebaseErrors(() =>
    sdk.signInWithPhoneNumber(firebase, phone, freshCaptcha(sdk, firebase)),
  );
  pending = { phone, confirmation };
}

/**
 * Firebase's ID token for the code sent last to `phone`, handed to `withToken` (the API call); once that succeeds the
 * code is spent and Firebase signed out, as the API's session is the only one that counts.
 */
async function withFirebaseToken<T>(
  options: FirebaseOptions,
  phone: string,
  code: string,
  withToken: (idToken: string) => Promise<T>,
): Promise<T> {
  // No code on its way to this number from this app run (the app was closed since): ask for a new one.
  if (pending?.phone !== phone) throw new HttpError(UNAUTHORIZED, Problem.noCodeSent);
  const { confirmation } = pending;
  const idToken = await withFirebaseErrors(async () => (await confirmation.confirm(code)).user.getIdToken());
  const result = await withToken(idToken);
  pending = undefined;
  await (await firebaseAuth(options)).auth.signOut();
  return result;
}

/** Sends a sign-in code to `phone` (E.164); sending again replaces the code before. */
export async function sendPhoneCode(phone: string): Promise<void> {
  const options = firebaseOptions();
  if (!options) return signInClient().requestOtp(phone);
  return sendWithFirebase(options, phone);
}

/**
 * Sends a code to a second number the signed-in person says they hold (the one linked to their Aadhaar); checking it
 * (`confirmPhoneCode`) never signs in with that number or changes the session.
 */
export async function sendConfirmCode(phone: string, session: Session): Promise<void> {
  const options = firebaseOptions();
  if (!options) return signInClient(session).requestConfirmCode(phone);
  return sendWithFirebase(options, phone);
}

/** Checks the code sent to a second number, as the signed-in person: the API confirms it and keeps nothing. */
export async function confirmPhoneCode(phone: string, code: string, session: Session): Promise<void> {
  const options = firebaseOptions();
  const client = signInClient(session);
  await (options
    ? withFirebaseToken(options, phone, code, (idToken) => client.confirmPhone({ phone, id_token: idToken }))
    : client.confirmPhone({ phone, code }));
}

/** Checks the code sent to `phone` and signs this device in with its public keys. */
export async function verifyPhoneCode(phone: string, code: string, device: DeviceRegistration): Promise<Session> {
  const options = firebaseOptions();
  if (!options) return signInClient().verifyOtp(phone, code, device);
  return withFirebaseToken(options, phone, code, (idToken) => signInClient().verifyPhoneToken(idToken, device));
}
