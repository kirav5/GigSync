import { apply, Collection, type Contact, newEngagement, type Storage, summarize } from "@gigsync/core";
import {
  type Engagement,
  EngagementStatus,
  EnvelopeKind,
  PAYEE_NAME_MAX,
  type Payment,
  Role,
  type UserId,
  Vpa,
} from "@gigsync/protocol";
import { ulid } from "ulid";

/** Where their UPI ID is kept: one record in this phone's settings, never in a payment or on a server. */
const PAYEE_KEY = "payee";
/** Brief field holding the consumer's name for a job recorded on this phone. */
export const CONSUMER_FIELD = "consumer";
const JOB_TOPIC = "gig_job";

export interface Payee {
  vpa: string;
  name: string;
}

export const loadPayee = (s: Storage) => s.get<Payee>(Collection.settings, PAYEE_KEY);

/** Saves the UPI ID and the name customers see; both are required, as the QR needs both. */
export async function savePayee(s: Storage, payee: Payee): Promise<void> {
  const vpa = payee.vpa.trim();
  const name = payee.name.trim();
  if (!Vpa.safeParse(vpa).success) throw new Error("That does not look like a UPI ID (name@bank).");
  if (!name) throw new Error("Enter the name customers will see when they pay you.");
  if (name.length > PAYEE_NAME_MAX) throw new Error(`Keep the name to ${PAYEE_NAME_MAX} characters.`);
  await s.put(Collection.settings, PAYEE_KEY, { vpa, name });
}

/** This phone's own user id. Until sign-in is wired into the app, a local id kept in settings. */
const SELF_KEY = "self";
export async function selfId(s: Storage): Promise<UserId> {
  const existing = await s.get<UserId>(Collection.settings, SELF_KEY);
  if (existing) return existing;
  const id = `usr_${ulid()}`;
  await s.put(Collection.settings, SELF_KEY, id);
  return id;
}

/** Jobs where this person is the worker (the provider side of the engagement). */
export async function workerJobs(s: Storage): Promise<Engagement[]> {
  const all = await s.list<Engagement>(Collection.engagements);
  return all.filter((e) => e.role === Role.enum.provider).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Pilot: records a job the worker agreed in person with a consumer, as an agreed engagement with a local contact. When
 * agent-to-agent agreement (G1) is wired into the app, jobs arrive here already agreed and signed by both phones.
 */
export async function recordJob(s: Storage, input: { consumer: string; work: string }, now: Date): Promise<Engagement> {
  const consumer: Contact = { id: `usr_${ulid(now.getTime())}`, name: input.consumer.trim() };
  await s.put(Collection.contacts, consumer.id, consumer);
  const draft = newEngagement(
    {
      role: Role.enum.provider,
      counterpart: consumer.id,
      brief: { text: input.work.trim(), topic: JOB_TOPIC, shared: { [CONSUMER_FIELD]: consumer.name } },
    },
    now,
  );
  const job = { ...draft, status: EngagementStatus.enum.agreed };
  await s.put(Collection.engagements, job.id, job);
  return job;
}

export const consumerName = (e: Engagement) => e.brief.shared[CONSUMER_FIELD] ?? "Customer";
export const jobLabel = (e: Engagement) => `${consumerName(e)} · ${e.brief.text}`;

/** Their moves on a job, as Collab envelope kinds: start work (update), then mark it done (delivery). */
export const JobMove = { start: EnvelopeKind.enum.update, done: EnvelopeKind.enum.delivery } as const;
export type JobMove = (typeof JobMove)[keyof typeof JobMove];

export async function moveJob(s: Storage, job: Engagement, move: JobMove, now: Date): Promise<Engagement> {
  const next = apply(job, move, now);
  await s.put(Collection.engagements, next.id, next);
  return next;
}

/** Where a job stands for the worker, as the four steps the screens show. */
export const JobStep = { agreed: 0, working: 1, done: 2, paid: 3 } as const;
export type JobStep = (typeof JobStep)[keyof typeof JobStep];
const E = EngagementStatus.enum;

export function jobStep(job: Engagement, payments: readonly Payment[]): JobStep {
  const mine = payments.filter((p) => p.engagement === job.id);
  const sum = summarize(mine);
  if (sum.confirmed > 0 && sum.outstanding === 0) return JobStep.paid;
  if (job.status === E.delivered || job.status === E.closed) return JobStep.done;
  if (job.status === E.in_progress) return JobStep.working;
  return JobStep.agreed;
}
