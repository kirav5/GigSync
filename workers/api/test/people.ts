import { SELF } from "cloudflare:test";
import { ApiClient, BEARER_PREFIX, Header, SecretKeys, sealEnvelope } from "@gigsync/core";
import { newDeviceSecrets } from "@gigsync/crypto";
import { type EngagementId, type Envelope, type EnvelopeKind, PROTOCOL_VERSION, type Session } from "@gigsync/protocol";
import { ulid } from "ulid";

const HOUR_MS = 3600_000;

/** One signed-in person with real device keys, calling the Worker through the core's API client. */
export interface Person {
  session: Session;
  keys: SecretKeys;
  api: ApiClient;
}

/** Each person is their own client IP, so the per-IP sign-in cap never spans tests. */
const clientFor = (ip: string) =>
  new ApiClient("http://x", (input, init) =>
    SELF.fetch(input, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), [Header.cfConnectingIp]: ip },
    }),
  );

export async function signIn(phone: string): Promise<Person> {
  const keys = new SecretKeys(newDeviceSecrets());
  const session = await clientFor(phone).verifyOtp(phone, "000000", { ...(await keys.publicKeys()), protocol: 1 });
  return { session, keys, api: clientFor(phone).as(session) };
}

/**
 * A real envelope from one person to another: sealed to the recipient's devices, signed by the sender's. On a fresh
 * engagement unless one is given.
 */
export async function envelope(
  from: Person,
  to: Person,
  kind: EnvelopeKind,
  body: unknown,
  engagement?: EngagementId,
): Promise<Envelope> {
  const { devices } = await from.api.directory(to.session.user);
  const now = Date.now();
  return sealEnvelope(
    {
      v: PROTOCOL_VERSION,
      id: `msg_${ulid(now)}`,
      from: { user: from.session.user, device: from.session.device },
      to: { user: to.session.user },
      engagement: engagement ?? `eng_${ulid(now)}`,
      seq: 0,
      kind,
      sent_at: new Date(now).toISOString(),
      expires_at: new Date(now + HOUR_MS).toISOString(),
    },
    body,
    devices.map((d) => ({ device: d.device_id, encryption_key: d.encryption_key })),
    from.keys,
  );
}

/** Posts an envelope as `as` and returns the raw status, for tests that expect a refusal. */
export async function post(as: Person, e: Envelope): Promise<number> {
  const res = await SELF.fetch(`http://x/v1/mailbox/${e.to.user}`, {
    method: "POST",
    headers: {
      [Header.authorization]: `${BEARER_PREFIX}${as.session.token}`,
      [Header.cfConnectingIp]: as.session.user,
    },
    body: JSON.stringify(e),
  });
  return res.status;
}
