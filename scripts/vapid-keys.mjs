// Makes the API's VAPID key pair for Web Push (workers/api/src/push/webpush.ts) and prints it once. The public key is a
// var (wrangler.toml, or .dev.vars locally); the private key is a secret: `wrangler secret put VAPID_PRIVATE_KEY`.
// Changing the pair later makes every phone subscribe again, which the app does by itself when it next opens.
import { webcrypto } from "node:crypto";

const { publicKey, privateKey } = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", publicKey));
const { d } = await webcrypto.subtle.exportKey("jwk", privateKey);
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
