import { FirebaseTokenClaims, FirebaseTokenHeader, GoogleJwks, Phone } from "@gigsync/protocol";
import { fromB64url } from "../push/b64.js";

/**
 * Checks a Firebase ID token without Firebase's SDK, as Firebase documents for third-party JWT libraries: an RS256
 * signature by one of Google's published keys, issued for our project, in date, for a signed-in user, naming a phone
 * number. The number is the only thing the API takes from it; the Firebase uid is not kept.
 */

/** Where Google publishes the keys Firebase signs ID tokens with, as a JSON Web Key Set. */
export const GOOGLE_KEYS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
/** A token's `iss` is this followed by the Firebase project id. */
export const ISSUER_PREFIX = "https://securetoken.google.com/";
/** The only signature algorithm Firebase ID tokens use; anything else is refused, never negotiated. */
export const ALG = "RS256";
export const RSA = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;
/** A JWT is header.payload.signature. */
const JWT_PARTS = 3;
const DOT = ".";
const MS_PER_S = 1000;
/** Clock difference tolerated between Google's servers and ours, for `iat` and `auth_time`. */
const CLOCK_SKEW_S = 60;
/** How long keys are kept when Google's answer names no max-age; Google's own is a few hours. */
const DEFAULT_KEYS_TTL_S = 60 * 60;
const MAX_AGE = /max-age=(\d+)/;

/** Why a token was refused. Safe to log: none names a value from the token. */
export const TokenProblem = {
  malformed: "malformed",
  wrongAlgorithm: "wrong algorithm",
  unknownKey: "unknown key",
  badSignature: "bad signature",
  wrongIssuer: "wrong issuer",
  wrongAudience: "wrong audience",
  expired: "expired",
  fromTheFuture: "issued in the future",
  noPhone: "no phone number",
} as const;
export type TokenProblem = (typeof TokenProblem)[keyof typeof TokenProblem];

export class TokenError extends Error {
  constructor(readonly problem: TokenProblem) {
    super(`firebase token refused: ${problem}`);
  }
}

/** The public key a token's `kid` names, or undefined when Google publishes none by that name. */
export type KeyLookup = (kid: string, now: Date) => Promise<CryptoKey | undefined>;

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function decodeJson(part: string): unknown {
  try {
    return JSON.parse(decoder.decode(fromB64url(part)));
  } catch {
    throw new TokenError(TokenProblem.malformed);
  }
}

/** The claims' rules once the signature holds: our project, in date, a user, a number. */
function checkClaims(claims: FirebaseTokenClaims, projectId: string, now: Date): Phone {
  const nowS = now.getTime() / MS_PER_S;
  if (claims.iss !== `${ISSUER_PREFIX}${projectId}`) throw new TokenError(TokenProblem.wrongIssuer);
  if (claims.aud !== projectId) throw new TokenError(TokenProblem.wrongAudience);
  if (claims.exp <= nowS) throw new TokenError(TokenProblem.expired);
  if (claims.iat > nowS + CLOCK_SKEW_S || claims.auth_time > nowS + CLOCK_SKEW_S)
    throw new TokenError(TokenProblem.fromTheFuture);
  const phone = Phone.safeParse(claims.phone_number);
  if (!phone.success) throw new TokenError(TokenProblem.noPhone);
  return phone.data;
}

/** The verified phone number a Firebase ID token for `projectId` names; throws TokenError when it is not one. */
export async function verifyIdToken(token: string, projectId: string, now: Date, keyFor: KeyLookup): Promise<Phone> {
  const parts = token.split(DOT);
  const [head, body, sig] = parts;
  if (parts.length !== JWT_PARTS || !head || !body || !sig) throw new TokenError(TokenProblem.malformed);
  const header = FirebaseTokenHeader.safeParse(decodeJson(head));
  if (!header.success) throw new TokenError(TokenProblem.malformed);
  if (header.data.alg !== ALG) throw new TokenError(TokenProblem.wrongAlgorithm);
  const key = await keyFor(header.data.kid, now);
  if (!key) throw new TokenError(TokenProblem.unknownKey);
  const signed = encoder.encode(`${head}${DOT}${body}`);
  if (!(await crypto.subtle.verify(RSA, key, fromB64url(sig), signed))) throw new TokenError(TokenProblem.badSignature);
  const claims = FirebaseTokenClaims.safeParse(decodeJson(body));
  if (!claims.success) throw new TokenError(TokenProblem.malformed);
  return checkClaims(claims.data, projectId, now);
}

export type KeysFetch = (url: string) => Promise<Response>;

/**
 * Google's signing keys, fetched once and kept for as long as Google's Cache-Control says. Google publishes a new key
 * well before it signs with it, so an unknown `kid` within that time is refused, never a reason to fetch again (which
 * would let anyone make the Worker call Google on every request). Concurrent requests share one fetch.
 */
export class GoogleKeys {
  private keys = new Map<string, CryptoKey>();
  private until = 0;
  private loading: Promise<void> | undefined;

  constructor(private readonly fetchFn: KeysFetch = (url) => fetch(url)) {}

  readonly keyFor: KeyLookup = async (kid, now) => {
    if (now.getTime() >= this.until) {
      this.loading ??= this.load(now).finally(() => {
        this.loading = undefined;
      });
      await this.loading;
    }
    return this.keys.get(kid);
  };

  private async load(now: Date): Promise<void> {
    const res = await this.fetchFn(GOOGLE_KEYS_URL);
    if (!res.ok) throw new Error(`google keys answered ${res.status}`);
    const jwks = GoogleJwks.parse(await res.json());
    const imported = await Promise.all(
      jwks.keys.map(async ({ kid, kty, n, e }) => {
        const key = await crypto.subtle.importKey("jwk", { kty, n, e, alg: ALG, ext: true }, RSA, false, ["verify"]);
        return [kid, key] as const;
      }),
    );
    const maxAge = Number(MAX_AGE.exec(res.headers.get("cache-control") ?? "")?.[1] ?? DEFAULT_KEYS_TTL_S);
    this.keys = new Map(imported);
    this.until = now.getTime() + maxAge * MS_PER_S;
  }
}

/** Google's keys, kept per isolate for as long as Google's Cache-Control allows; shared by sign-in and confirming. */
export const googleKeys = new GoogleKeys();
