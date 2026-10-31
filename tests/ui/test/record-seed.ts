import { Header, RecordsClient, SecretKeys } from "@gigsync/core";
import { newDeviceSecrets, termsHash, toBase64 } from "@gigsync/crypto";
import {
  type AreaKey,
  agreeBytes,
  type EngagementId,
  type JobRecordSubmit,
  type JobTerms,
  type OfferId,
  Role,
  type UserId,
} from "@gigsync/protocol";
import { API, DEV_OTP, newPhone } from "./helpers.js";

/** One finished job to seed: which household it was for (jobs with the same number are one household) and its stars. */
export interface SeededJob {
  household: number;
  stars?: number;
}

/** A person signed in straight through the API, with the device keys their phone would hold. */
export interface ApiPerson {
  api: RecordsClient;
  keys: SecretKeys;
  user: UserId;
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_LENGTH = 26;
export const id = (prefix: string) =>
  `${prefix}_${Array.from({ length: ULID_LENGTH }, () => CROCKFORD[Math.floor(Math.random() * CROCKFORD.length)]).join("")}`;
const PRICE_PAISE = 1_100_000;
const IP_PART = 250;

/** Signs a number in from an address of its own (the API limits codes per address), and agrees to the notice. */
export async function person(phone: string): Promise<ApiPerson> {
  const keys = new SecretKeys(newDeviceSecrets());
  const ip = `10.78.${Math.floor(Math.random() * IP_PART)}.${Math.floor(Math.random() * IP_PART)}`;
  const anon = new RecordsClient(API, (input, init) =>
    fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), [Header.cfConnectingIp]: ip } }),
  );
  const session = await anon.verifyOtp(phone, DEV_OTP, { ...(await keys.publicKeys()), protocol: 1 });
  const api = new RecordsClient(API, undefined, session);
  await api.acceptConsent();
  return { api, keys, user: session.user };
}

/** One side's submission of a job both signed: the same fields, its own role and signature, and the job's area if any. */
export async function submit(
  side: ApiPerson,
  other: ApiPerson,
  role: Role,
  terms: JobTerms,
  area?: AreaKey,
): Promise<JobRecordSubmit> {
  const hash = termsHash(terms);
  return {
    engagement: terms.engagement,
    counterpart: other.user,
    role,
    work: { trade: "cook", scope: { people: "3_4", meals: "2" } },
    ...(area ? { area } : {}),
    terms: {},
    price_paise: terms.price_paise,
    terms_hash: hash,
    sig: toBase64(await side.keys.sign(agreeBytes(hash))),
  };
}

/**
 * Cooking jobs the worker with this number did, kept by GigSync as two real phones would leave them (ADR 0038): both
 * sides submit the job with their signatures, it is marked done, and each household gives its stars. The worker then
 * signs in on the app with the same number, and the record the server serves is these jobs.
 */
export async function seedServedJobs(workerPhone: string, jobs: readonly SeededJob[]): Promise<void> {
  const worker = await person(workerPhone);
  const households = new Map<number, ApiPerson>();
  for (const n of new Set(jobs.map((j) => j.household))) households.set(n, await person(newPhone()));
  // One job after another: each is two submissions, a status and stars, against one worker's hourly limit.
  for (const { household, stars } of jobs) {
    const home = households.get(household) as ApiPerson;
    const engagement = id("eng") as EngagementId;
    const terms: JobTerms = {
      engagement,
      offer_id: id("off") as OfferId,
      worker: worker.user,
      consumer: home.user,
      trade: "cook",
      scope: "Cooking",
      slot: "mornings",
      price_paise: PRICE_PAISE,
    };
    await worker.api.submitJob(await submit(worker, home, Role.enum.provider, terms));
    await home.api.submitJob(await submit(home, worker, Role.enum.requester, terms));
    await worker.api.reportStatus(engagement, { status: "done" });
    if (stars !== undefined) await home.api.reportStars(engagement, { stars });
  }
}
