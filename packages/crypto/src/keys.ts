import type { DeviceRegistration } from "@gigsync/protocol";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { fromBase64, toBase64 } from "./base64.js";

/** A device's two private keys, base64. They never leave the device; only the public halves are registered. */
export interface DeviceSecrets {
  /** Ed25519: signs every envelope and the job terms. */
  signing: string;
  /** X25519: opens envelopes sealed to this device. */
  encryption: string;
}

export type DevicePublicKeys = Pick<DeviceRegistration, "signing_key" | "encryption_key">;

export function newDeviceSecrets(): DeviceSecrets {
  return {
    signing: toBase64(ed25519.utils.randomSecretKey()),
    encryption: toBase64(x25519.utils.randomSecretKey()),
  };
}

/** The public keys a device registers at sign-in. */
export function publicKeysOf(secrets: DeviceSecrets): DevicePublicKeys {
  return {
    signing_key: toBase64(ed25519.getPublicKey(fromBase64(secrets.signing))),
    encryption_key: toBase64(x25519.getPublicKey(fromBase64(secrets.encryption))),
  };
}

export function sign(bytes: Uint8Array, signingSecret: string): Uint8Array {
  return ed25519.sign(bytes, fromBase64(signingSecret));
}

/** False for a wrong signature, a wrong key or malformed input; never throws on bad data. */
export function verify(bytes: Uint8Array, signature: string, signingKey: string): boolean {
  try {
    return ed25519.verify(fromBase64(signature), bytes, fromBase64(signingKey));
  } catch {
    return false;
  }
}
