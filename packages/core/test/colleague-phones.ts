import { newDeviceSecrets } from "@gigsync/crypto";
import {
  COLLEAGUE_PROTOCOL,
  type ColleagueCard,
  type DeviceId,
  type EngagementId,
  type EnvelopeKind,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { MailTransport, MemoryStorage, type Relay, SecretKeys, SystemClock, settle } from "../src/index.js";
import { MemoryRelay, type Phone } from "./phones.js";

/** The protocol number a phone from before colleagues reports. */
const OLD_PROTOCOL = 1;

/** The in-memory relay, with every phone on the colleague protocol unless marked as an older app. */
export class ColleagueRelay extends MemoryRelay {
  private readonly old = new Set<UserId>();

  /** This user's phones run a GigSync from before colleagues. */
  outdated(user: UserId): void {
    this.old.add(user);
  }

  override for(me: { user: UserId; device: DeviceId }): Relay {
    const base = super.for(me);
    return {
      ...base,
      directory: async (user) => {
        const entry = await base.directory(user);
        const protocol = this.old.has(user) ? OLD_PROTOCOL : COLLEAGUE_PROTOCOL;
        return { ...entry, devices: entry.devices.map((d) => ({ ...d, protocol })) };
      },
    };
  }
}

/** Someone with keys and a mailbox but no GigDevice: sends whatever envelope a test needs, as a stranger would. */
export async function stranger(relay: MemoryRelay) {
  const keys = new SecretKeys(newDeviceSecrets());
  const me = { user: `usr_${ulid()}` as UserId, device: `dev_${ulid()}` as DeviceId };
  relay.register(me.user, me.device, await keys.publicKeys());
  const transport = new MailTransport(relay.for(me), new MemoryStorage(), keys, new SystemClock(), me);
  return {
    user: me.user,
    async send(to: UserId, channel: EngagementId, kind: EnvelopeKind, body: unknown) {
      await transport.send(to, channel, kind, body);
      await transport.flush();
    },
  };
}

export const ASHA_CARD: ColleagueCard = { name: "Asha", trades: ["cook"], languages: ["kn", "en"] };
export const RAVI_CARD: ColleagueCard = { name: "Ravi", trades: ["electrician"], languages: ["hi", "en"] };
export const SURESH_CARD: ColleagueCard = { name: "Suresh", trades: ["electrician"], languages: ["hi"] };

/** `shower` shows a colleague code, `scanner` scans it, and their phones talk until the link settles. */
export async function linked(shower: Phone, showerCard: ColleagueCard, scanner: Phone, scannerCard: ColleagueCard) {
  const code = await shower.device.colleagues.invite(showerCard);
  await scanner.device.colleagues.link(code, scannerCard);
  await settle([scanner.device, shower.device]);
  return code;
}

/** One colleague as a phone lists them. */
export async function colleagueOf(p: Phone, user: UserId) {
  return (await p.device.colleagues.list()).find((c) => c.user === user);
}
