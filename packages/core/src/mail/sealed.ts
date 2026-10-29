import { type Recipient, seal, toBase64, verify } from "@gigsync/crypto";
import { BODY, type DeviceId, type Envelope, type EnvelopeHeader, signingBytes } from "@gigsync/protocol";
import type { Keys } from "../ports.js";

/** An envelope that failed its signature or could not be opened by this device. */
export class EnvelopeError extends Error {}

/** Seals `body` to the recipient's devices and signs the result with this device's key. */
export async function sealEnvelope(
  header: EnvelopeHeader,
  body: unknown,
  to: readonly Recipient[],
  keys: Keys,
): Promise<Envelope> {
  const sealed = seal(new TextEncoder().encode(JSON.stringify(body)), to);
  const unsigned = { ...header, ...sealed };
  const sig = toBase64(await keys.sign(signingBytes(unsigned)));
  return { ...unsigned, sig };
}

/**
 * Checks the sender's signature against the key the directory lists for their device, opens the body for this
 * device and parses it with the schema of its kind. Throws EnvelopeError on any failure, so nothing unverified or
 * malformed reaches the agent.
 */
export async function openEnvelope(e: Envelope, me: DeviceId, keys: Keys, senderSigningKey: string): Promise<unknown> {
  if (!verify(signingBytes(e), e.sig, senderSigningKey)) throw new EnvelopeError(`bad signature on ${e.id}`);
  let opened: unknown;
  try {
    const bytes = await keys.open({ epk: e.epk, keys: e.keys, ciphertext: e.ciphertext }, me);
    opened = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new EnvelopeError(`cannot open ${e.id}`);
  }
  const body = BODY[e.kind].safeParse(opened);
  if (!body.success) throw new EnvelopeError(`malformed ${e.kind} body in ${e.id}`);
  return body.data;
}
