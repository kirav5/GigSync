import type { Phone } from "@gigsync/protocol";
import { hmacHex, sameSecret } from "../crypto.js";
import type { Db } from "../db/client.js";
import { dropCode, keepCode, pendingCode } from "../db/otp-codes.js";
import type { CodeSender } from "./senders.js";

/**
 * Codes the API makes and checks itself (ADR 0069), for the channels it sends on (WhatsApp, MSG91's SMS); Firebase's
 * SMS codes are made and checked by Firebase. A code is six digits, kept only as an HMAC tied to its number, and signs in once.
 */

const CODE_DIGITS = 6;
const CODE_SPACE = 10 ** CODE_DIGITS;
/** The largest multiple of the code space a 32-bit draw can reach; draws above it are redrawn, so no code is likelier. */
const FAIR_LIMIT = Math.floor(2 ** 32 / CODE_SPACE) * CODE_SPACE;

/** A uniformly random six-digit code, leading zeros kept. */
export function newCode(): string {
  const draw = new Uint32Array(1);
  do crypto.getRandomValues(draw);
  while ((draw[0] ?? FAIR_LIMIT) >= FAIR_LIMIT);
  return String((draw[0] ?? 0) % CODE_SPACE).padStart(CODE_DIGITS, "0");
}

/** The code as kept: tied to the number's hash, so the same code for two numbers is two different values. */
const codeHash = (key: string, phoneHmac: string, code: string) => hmacHex(key, `${phoneHmac}:${code}`);

/** Why a code was not sent. */
export const SendRefused = { tooSoon: "too soon", failed: "failed" } as const;
export type SendRefused = (typeof SendRefused)[keyof typeof SendRefused];

/** What a send came to: the channel the code went by, or why it did not go. */
export type Issued = { channel: CodeSender["channel"] } | { refused: SendRefused };

/** What a send needs: the database, the HMAC key, and the number both as typed and hashed. */
export interface CodeTarget {
  db: Db;
  key: string;
  phone: Phone;
  phoneHmac: string;
  now: Date;
}

/**
 * Makes a code for the number, keeps it, and sends it by the first sender that takes it (WhatsApp, then SMS). Refused
 * when the number was sent one just now or has had its codes for the hour; when no sender took it the code is
 * forgotten, so asking again is not held up.
 */
export async function issueCode(target: CodeTarget, senders: readonly CodeSender[]): Promise<Issued> {
  const code = newCode();
  const hash = await codeHash(target.key, target.phoneHmac, code);
  if (!(await keepCode(target.db, target.phoneHmac, hash, target.now))) return { refused: SendRefused.tooSoon };
  for (const sender of senders) if (await sender.send(target.phone, code)) return { channel: sender.channel };
  await dropCode(target.db, target.phoneHmac);
  return { refused: SendRefused.failed };
}

/** True when `code` is the number's pending code and has not expired; the caller drops it once signed in. */
export async function codeMatches(target: CodeTarget, code: string): Promise<boolean> {
  const stored = await pendingCode(target.db, target.phoneHmac, target.now);
  if (!stored) return false;
  return sameSecret(await codeHash(target.key, target.phoneHmac, code), stored.code_hash);
}
