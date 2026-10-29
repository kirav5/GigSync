import { newDeviceSecrets } from "@gigsync/crypto";
import {
  type Agree,
  type ColleagueCard,
  type ContactCard,
  type DeviceId,
  type EngagementId,
  type EnvelopeKind,
  LinkKind,
  MENTOR_LINK_TTL_MS,
  MentorRole,
  type OfferId,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import {
  Collection,
  type JobRecord,
  JobStore,
  MailTransport,
  MemoryStorage,
  type MentorLink,
  type PastLink,
  SecretKeys,
  SystemClock,
} from "../src/index.js";
import { BENGALURU, type MemoryRelay, type Phone } from "./phones.js";

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

/** One live mentor link as a phone lists it. */
export async function linkOf(p: Phone, user: UserId): Promise<MentorLink | undefined> {
  return (await p.device.mentors.links()).find((l) => l.user === user);
}

type Side = { phone: Phone; contact: ContactCard };

/**
 * A finished cooking job between a household and a worker, written into both phones' storage on one engagement id:
 * both signed the same terms and each holds the other's contact card. With `signed: false` only the household
 * signed, and no card has come.
 */
export async function seedJob(household: Side, worker: Side, { signed = true } = {}): Promise<EngagementId> {
  const id = `eng_${ulid()}` as EngagementId;
  const agree: Agree = {
    terms: {
      engagement: id,
      offer_id: `off_${ulid()}` as OfferId,
      worker: worker.phone.user,
      consumer: household.phone.user,
      trade: "cook",
      scope: "Cooking",
      slot: "mornings",
      price_paise: 900_000,
    },
    terms_hash: "a".repeat(64),
    sig: "c2lnbmVk",
  };
  const at = new Date().toISOString();
  const record = (role: "requester" | "provider", other: Side): JobRecord => ({
    engagement: {
      id,
      group: id,
      role,
      counterpart: other.phone.user,
      status: "closed",
      brief: { text: "Cooking", topic: "cook", shared: {} },
      created_at: at,
      updated_at: at,
    },
    request: { need: "Cooking", trade: "cook", when: "mornings", area: BENGALURU, details: {}, lang: "en" },
    offers: [],
    offers_made: 0,
    asked: false,
    mine: agree,
    ...(signed ? { theirs: agree, contact: other.contact } : {}),
  });
  await new JobStore(household.phone.storage).saveJob(record("requester", worker));
  await new JobStore(worker.phone.storage).saveJob(record("provider", household));
  return id;
}

/** A live mentor link between two phones, written into both phones' storage on one channel; `a` is the mentor. */
export async function seedLink(a: Phone, aCard: ColleagueCard, b: Phone, bCard: ColleagueCard): Promise<void> {
  const channel = `eng_${ulid()}` as EngagementId;
  const now = new Date();
  const link = (user: UserId, card: ColleagueCard, role: MentorRole): MentorLink => ({
    user,
    card,
    channel,
    linked_at: now.toISOString(),
    unread: 0,
    kind: LinkKind.enum.mentor,
    expires_at: new Date(now.getTime() + MENTOR_LINK_TTL_MS).toISOString(),
    mentor: { role },
  });
  await a.storage.put(Collection.mentorLinks, b.user, link(b.user, bCard, MentorRole.enum.mentor));
  await b.storage.put(Collection.mentorLinks, a.user, link(a.user, aCard, MentorRole.enum.newcomer));
}

/** A mentor link with `user` that ended on this phone some time ago. */
export async function seedPastLink(p: Phone, user: UserId, card: ColleagueCard): Promise<void> {
  const past: PastLink = { user, card, ended_at: new Date().toISOString() };
  await p.storage.put(Collection.pastLinks, user, past);
}
