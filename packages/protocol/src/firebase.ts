import { z } from "zod";

/**
 * What Google answers and signs for Firebase phone sign-in, as far as the API reads it: the public keys Firebase signs
 * ID tokens with (a JSON Web Key Set), and an ID token's header and claims. Parsed at the boundary, unknown fields
 * ignored. The API checks the signature and claims itself; these only give the parts their shape.
 */

/** More keys than Google ever publishes at once (two or three); a cap on what one fetch may make the Worker import. */
const MAX_JWKS = 10;
/** Longer than any RSA modulus Google uses, in base64url characters (4096 bits is 683). */
const MAX_JWK_PART = 1024;
/** Firebase uids are at most 128 characters. */
const MAX_UID = 128;

const GoogleJwk = z.object({
  kid: z.string().min(1).max(MAX_JWK_PART),
  kty: z.literal("RSA"),
  n: z.string().min(1).max(MAX_JWK_PART),
  e: z.string().min(1).max(MAX_JWK_PART),
});

/** `GET https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`. */
export const GoogleJwks = z.object({ keys: z.array(GoogleJwk).max(MAX_JWKS) });

/** A Firebase ID token's header: RS256, signed by the key named `kid`. */
export const FirebaseTokenHeader = z.object({ alg: z.string(), kid: z.string().min(1).max(MAX_JWK_PART) });

/** A Firebase ID token's claims (seconds since the epoch for the times); `phone_number` only on phone sign-in. */
export const FirebaseTokenClaims = z.object({
  iss: z.string(),
  aud: z.string(),
  sub: z.string().min(1).max(MAX_UID),
  exp: z.number(),
  iat: z.number(),
  auth_time: z.number(),
  phone_number: z.string().optional(),
});
export type FirebaseTokenClaims = z.infer<typeof FirebaseTokenClaims>;
