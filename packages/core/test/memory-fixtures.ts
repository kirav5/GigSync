import { type EngagementId, Role, type Trade, type UserId } from "@gigsync/protocol";
import { householdKnown, type JobRecord, MemoryStorage, type MemoryWriter } from "../src/index.js";

export const HOME = "usr_01HOME0000000000000000000" as UserId;
export const WORKER = "usr_01WORKER00000000000000000" as UserId;
const HASH = "a".repeat(64);
const SIG = "c2ln";

/** A phone's memory owner on its own storage, with a fixed day. */
export function writer(owner: UserId, day = "2026-10-01"): MemoryWriter & { storage: MemoryStorage } {
  return { storage: new MemoryStorage(), me: { user: owner }, clock: { now: () => new Date(`${day}T09:00:00Z`) } };
}

/** The owner's remembered facts as plain values, as the household's agent reads them. */
export async function factValues(owner: MemoryWriter): Promise<Record<string, string | undefined>> {
  const { facts } = await householdKnown(owner);
  return Object.fromEntries(Object.entries(facts).map(([key, known]) => [key, known?.value]));
}

/** One job as `role` sees it, signed by both unless `signed` is false. */
export function job(
  o: {
    id?: string;
    role?: Role;
    trade?: Trade;
    details?: Record<string, string>;
    answers?: Record<string, string>;
    questions?: JobRecord["questions"];
    signed?: boolean;
    contact?: JobRecord["contact"];
  } = {},
): JobRecord {
  const role = o.role ?? Role.enum.requester;
  const id = (o.id ?? "eng_01JOB000000000000000000000") as EngagementId;
  const trade = o.trade ?? "cook";
  const at = "2026-10-01T09:00:00.000Z";
  const terms = {
    engagement: id,
    offer_id: "off_01OFFER00000000000000000000",
    worker: WORKER,
    consumer: HOME,
    trade,
    scope: "cooking",
    slot: "mornings",
    price_paise: 900000,
  };
  const agree = { terms, terms_hash: HASH, sig: SIG };
  return {
    engagement: {
      id,
      group: id,
      role,
      counterpart: role === Role.enum.requester ? WORKER : HOME,
      status: "agreed",
      brief: { text: "cook", topic: trade, shared: {} },
      created_at: at,
      updated_at: at,
    },
    request: {
      trade,
      need: "need a cook",
      when: "mornings",
      area: { lat: 12.97, lon: 77.64 },
      details: o.details ?? {},
      lang: "en",
    },
    offers: [],
    offers_made: 0,
    asked: false,
    ...(o.signed === false ? {} : { mine: agree, theirs: agree }),
    ...(o.answers ? { answers: o.answers } : {}),
    ...(o.questions ? { questions: o.questions } : {}),
    ...(o.contact ? { contact: o.contact } : {}),
  };
}
