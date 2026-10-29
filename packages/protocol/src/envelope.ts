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
  /** Worker → consumer: an offer for the job (price, slot, scope). */
  "quote",
  /** Consumer → worker: a counter-offer to the last quote. */
  "counter",
  /** Either side signs the agreed terms; the job is agreed once both have (two `agree`s on one terms hash). */
  "agree",
  /** Either side → the other, once agreed: the sender's contact card. Does not move the engagement. */
  "contact_release",
  "update",
  "delivery",
  "review",
  "cancel",
  "receipt",
  "key_change",
  /** Worker → consumer: pay this amount for the job. Carries their UPI ID, sealed. Does not move the engagement. */
  "payment_request",
  /** Either side → the other: a payment was made (UPI ref) or confirmed. Does not move the engagement. */
  "payment_record",
  /** Worker ↔ worker met in person: ask to link (with the scanned code), ok, or end. Not part of any engagement. */
  "colleague",
  /** Linked colleague → colleague: a message. Not part of any engagement. */
  "colleague_note",
  /** Worker → household, on a request the worker declined: a colleague to ask instead. Does not move the engagement. */
  "referral",
  /** A colleague → two of their linked colleagues: an introduction naming the other, toward a mentor link. */
  "introduce",
  /** Newcomer → a mentor they picked: help me move to this city. */
  "landing_request",
  /** Mentor → newcomer: yes (with the mentor's card) or no to a landing request. */
  "mentor_offer",
  /** Newcomer → mentor, or each side of an introduction → the other: confirm (opens the mentor link) or close. */
  "mentor_accept",
]);
export type EnvelopeKind = z.infer<typeof EnvelopeKind>;

const K = EnvelopeKind.enum;
/** Kinds that travel alongside an engagement without moving its status. */
export const SIDE_CHANNEL_KINDS: ReadonlySet<EnvelopeKind> = new Set([
  K.contact_release,
  K.payment_request,
  K.payment_record,
  K.key_change,
  K.referral,
]);

/**
 * Kinds between colleagues, outside any job: their `engagement` is the pair's channel id, and the engagement state
 * table never sees them.
 */
export const COLLEAGUE_KINDS: ReadonlySet<EnvelopeKind> = new Set([K.colleague, K.colleague_note]);

/**
 * Kinds that lead to a mentor link, outside any job: their `engagement` is the channel the link will use. Only sent
 * when every device of the recipient reports `MENTOR_PROTOCOL`.
 */
export const MENTOR_KINDS: ReadonlySet<EnvelopeKind> = new Set([
  K.introduce,
  K.landing_request,
  K.mentor_offer,
  K.mentor_accept,
]);

export const Base64 = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "base64");
/** A person has at most this many devices to seal one envelope to. */
export const MAX_RECIPIENT_DEVICES = 10;
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
  /** The sender's one-time X25519 public key for this envelope. */
  epk: Base64,
  /** The body's content key, wrapped once for each recipient device that may open it. */
  keys: z
    .record(DeviceId, Base64)
    .refine((k) => Object.keys(k).length >= 1 && Object.keys(k).length <= MAX_RECIPIENT_DEVICES, "1 to 10 devices"),
  /** XChaCha20-Poly1305 over the JSON body; only the devices in `keys` can read it. */
  ciphertext: Base64,
  /** Ed25519 by the sending device over the canonical JSON of everything above. */
  sig: Base64,
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
