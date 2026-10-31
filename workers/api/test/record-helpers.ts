import { HttpMethod } from "@gigsync/core";
import { toBase64 } from "@gigsync/crypto";
import {
  agreeBytes,
  type BoardProfile,
  type EngagementId,
  EnvelopeKind,
  type JobQuantities,
  type JobRecordSubmitInput,
  JobSubmitState,
  RECORDS_NOTICE_VERSION,
  Role,
  type UserId,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { expect } from "vitest";
import { call } from "./mentor-helpers.js";
import { envelope, type Person, post, signIn } from "./people.js";

/** Mysuru, so these workers never meet the ones other test files put on the board. */
export const MYSURU = { lat: 12.3, lon: 76.64 };
const OK = 200;

export const newEngagement = (): EngagementId => `eng_${ulid()}`;
/** A terms hash stands in for the real one: the server only checks that both sides signed the same hash. */
export const newHash = (): string =>
  Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const STORED = 201;

/** `from` delivers its signed `agree` on `engagement` to `to` through the mailbox, as its phone does on signing. */
export async function deliverAgree(from: Person, to: Person, engagement: EngagementId): Promise<void> {
  expect(await post(from, await envelope(from, to, EnvelopeKind.enum.agree, {}, engagement))).toBe(STORED);
}

/** Signs in and accepts the current records notice. */
export async function consented(phone: string): Promise<Person> {
  const p = await signIn(phone);
  expect((await call(p, HttpMethod.put, "/consent", { notice_version: RECORDS_NOTICE_VERSION })).status).toBe(OK);
  return p;
}

/** One painting job as the worker agreed it; `role` and `counterpart` are filled per side. */
export const paintJob = (engagement: EngagementId, hash: string, price = 900000) => ({
  engagement,
  work: { trade: "painter" as const, scope: { rooms: "bhk2" as const, labour_only: "yes" as const } },
  terms: { when: { day: "2026-11-02", window: "morning" as const }, coats: 2 },
  price_paise: price,
  terms_hash: hash,
});

/** A job as one side submits it, with the pilot area its request named and its quantities, when there are. */
type Job = ReturnType<typeof paintJob> & { area?: string; quantities?: JobQuantities };

/** `as` submits `job` as the worker (provider) or household (requester), signed with `signer`'s key (default theirs). */
export async function submit(
  as: Person,
  counterpart: Person,
  role: Role,
  job: Job,
  signer: Person = as,
): Promise<Response> {
  const sig = toBase64(await signer.keys.sign(agreeBytes(job.terms_hash)));
  const body: JobRecordSubmitInput = { ...job, counterpart: counterpart.session.user, role, sig };
  return call(as, HttpMethod.post, "/jobs/records", body);
}

export const asWorker = (w: Person, home: Person, job: Job) => submit(w, home, Role.enum.provider, job);
export const asHousehold = (home: Person, w: Person, job: Job) => submit(home, w, Role.enum.requester, job);

/** The state a submission came to; fails the test on any refusal. */
export async function stateOf(res: Response): Promise<JobSubmitState> {
  expect(res.status).toBe(OK);
  return ((await res.json()) as { state: JobSubmitState }).state;
}

/** A job both sides attested; returns its engagement. */
export async function storedJob(w: Person, home: Person, price?: number): Promise<EngagementId> {
  const job = paintJob(newEngagement(), newHash(), price);
  expect(await stateOf(await asHousehold(home, w, job))).toBe(JobSubmitState.enum.pending);
  expect(await stateOf(await asWorker(w, home, job))).toBe(JobSubmitState.enum.stored);
  return job.engagement;
}

/** The household gives stars on a stored job. */
export async function rate(home: Person, engagement: EngagementId, stars: number): Promise<void> {
  expect((await call(home, HttpMethod.put, `/jobs/records/${engagement}/stars`, { stars })).status).toBe(204);
}

export const workerCard = (name: string, km = 0, more: Partial<BoardProfile> = {}): BoardProfile => ({
  display_name: name,
  trades: ["painter"],
  area: { lat: MYSURU.lat + km / 111, lon: MYSURU.lon },
  area_name: "Mysuru",
  rate_paise: 80000,
  languages: ["kn"],
  about: "",
  ...more,
});

/** One worker's card as `as` is served it through GET /v1/board/workers/:user. */
export async function cardOf(as: Person, user: UserId): Promise<BoardProfile> {
  const res = await call(as, HttpMethod.get, `/board/workers/${user}`);
  expect(res.status).toBe(OK);
  return res.json();
}
