import { ALG, ISSUER_PREFIX, RSA } from "../src/auth/firebase.js";
import { b64url } from "../src/push/b64.js";

/** Firebase ID tokens signed with a key pair made here, and Google's key endpoint answering with its public half. */

export const PROJECT = "gigsync-test";
export const KID = "test-key";
const MODULUS_BITS = 2048;
const PUBLIC_EXPONENT = new Uint8Array([1, 0, 1]);
const S = 1000;
/** Firebase ID tokens last an hour. */
const TOKEN_LIFE_S = 3600;

export interface TestSigner {
  /** What Google's key endpoint answers: the public key, cacheable for an hour. */
  keysResponse(): Response;
  sign(claims: Record<string, unknown>, header?: Record<string, unknown>): Promise<string>;
}

export async function testSigner(): Promise<TestSigner> {
  const pair = (await crypto.subtle.generateKey(
    { ...RSA, modulusLength: MODULUS_BITS, publicExponent: PUBLIC_EXPONENT },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const encode = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));
  return {
    keysResponse: () =>
      Response.json(
        { keys: [{ kid: KID, kty: jwk.kty, n: jwk.n, e: jwk.e, alg: ALG, use: "sig" }] },
        { headers: { "cache-control": "public, max-age=3600, must-revalidate" } },
      ),
    async sign(claims, header = { alg: ALG, kid: KID, typ: "JWT" }) {
      const signed = `${encode(header)}.${encode(claims)}`;
      const sig = await crypto.subtle.sign(RSA, pair.privateKey, new TextEncoder().encode(signed));
      return `${signed}.${b64url(new Uint8Array(sig))}`;
    },
  };
}

/** The claims Firebase puts in an ID token for a phone sign-in at `now`, with `over` replacing any of them. */
export function claimsFor(phone: string, now: Date, over: Record<string, unknown> = {}): Record<string, unknown> {
  const t = Math.floor(now.getTime() / S);
  return {
    iss: `${ISSUER_PREFIX}${PROJECT}`,
    aud: PROJECT,
    sub: "firebase-uid-1",
    user_id: "firebase-uid-1",
    iat: t,
    auth_time: t,
    exp: t + TOKEN_LIFE_S,
    phone_number: phone,
    firebase: { identities: { phone: [phone] }, sign_in_provider: "phone" },
    ...over,
  };
}
