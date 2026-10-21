import { z } from "zod";
import { ChainId, DeviceId, EngagementId, MessageId, UserId } from "./ids.js";

export const PROTOCOL_VERSION = 1 as const;
/** A delegation chain (worker → worker → …) may go this deep. */
export const MAX_HOP_DEPTH = 3;

/** What an envelope does to its engagement. The engagement state table decides whether it is allowed. */
export const EnvelopeKind = z.enum([
  "request",
  "clarify",
  "response",
  "quote",
  "agree",
  "update",
  "delivery",
  "review",
  "cancel",
  "receipt",
  "key_change",
]);
export type EnvelopeKind = z.infer<typeof EnvelopeKind>;

const base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "base64");
const isoDate = z.string().datetime({ offset: true });

/** Everything the mailbox needs to route and expire an envelope. Content stays inside `ciphertext`. */
export const EnvelopeHeader = z.object({
  v: z.literal(PROTOCOL_VERSION),
  id: MessageId,
  from: z.object({ user: UserId, device: DeviceId }),
  to: z.object({ user: UserId }),
  engagement: EngagementId,
  /** Per engagement, per sender. Receivers deliver in order and hold gaps. */
  seq: z.number().int().nonnegative(),
  kind: EnvelopeKind,
  sent_at: isoDate,
  expires_at: isoDate,
  hop: z.object({ chain: ChainId, depth: z.number().int().min(1).max(MAX_HOP_DEPTH) }).optional(),
});
export type EnvelopeHeader = z.infer<typeof EnvelopeHeader>;

export const Envelope = EnvelopeHeader.extend({
  ciphertext: base64,
  /** Ed25519 over the canonical JSON of the header plus ciphertext. */
  sig: base64,
});
export type Envelope = z.infer<typeof Envelope>;

/** The bytes a sender signs: header and ciphertext, keys sorted, no whitespace. */
export function signingBytes(e: Omit<Envelope, "sig">): Uint8Array {
  const { sig: _drop, ...rest } = e as Envelope;
  return new TextEncoder().encode(canonicalJson(rest));
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const keys = Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Default lifetimes before the mailbox expires an undelivered envelope. */
export const DEFAULT_TTL_SECONDS: Record<"question" | "job", number> = {
  question: 24 * 60 * 60,
  job: 7 * 24 * 60 * 60,
};
