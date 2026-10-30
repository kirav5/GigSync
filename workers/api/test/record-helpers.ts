import { HttpMethod } from "@gigsync/core";
import {
  type BoardProfile,
  type EngagementId,
  EnvelopeKind,
  type Trade,
  type UserId,
  type WorkerRecord,
} from "@gigsync/protocol";
import { ulid } from "ulid";
import { expect } from "vitest";
import { call } from "./mentor-helpers.js";
import { envelope, type Person, post, signIn } from "./people.js";

const K = EnvelopeKind.enum;
/** Hubballi, so these workers never meet the ones other test files put on the board. */
export const HUBBALLI = { lat: 15.36, lon: 75.12 };
/** Roughly this many kilometres north of Hubballi. */
const north = (km: number) => ({ lat: HUBBALLI.lat + km / 111, lon: HUBBALLI.lon });
const STORED = 201;

export const recordCard = (name: string, record?: WorkerRecord, km = 0, trades: Trade[] = ["painter"]) =>
  ({
    display_name: name,
    trades,
    area: north(km),
    area_name: "Hubballi",
    rate_paise: 80000,
    languages: ["kn"],
    about: "",
    ...(record && { record }),
  }) satisfies BoardProfile;

export const newEngagement = (): EngagementId => `eng_${ulid()}`;

/** Delivers one envelope of `kind` on `engagement` and expects the mailbox to store it. */
export async function deliver(from: Person, to: Person, kind: EnvelopeKind, engagement: EngagementId): Promise<void> {
  expect(await post(from, await envelope(from, to, kind, {}, engagement))).toBe(STORED);
}

/** `from` signs the terms of `engagement` with `to`. */
export const agree = (from: Person, to: Person, engagement: EngagementId) => deliver(from, to, K.agree, engagement);

/** `from` reviews `to` on `engagement`. */
export const review = (from: Person, to: Person, engagement: EngagementId) => deliver(from, to, K.review, engagement);

/** A job both sides signed, the household first; returns its engagement. */
export async function signedJob(worker: Person, home: Person): Promise<EngagementId> {
  const engagement = newEngagement();
  await agree(home, worker, engagement);
  await agree(worker, home, engagement);
  return engagement;
}

/** A worker signed in with their card on the board. */
export async function listed(phone: string, name: string, record?: WorkerRecord, km = 0): Promise<Person> {
  const p = await signIn(phone);
  await p.api.publishProfile(recordCard(name, record, km));
  return p;
}

/** One worker's card as `as` is served it through GET /v1/board/workers/:user. */
export async function cardOf(as: Person, user: UserId): Promise<BoardProfile> {
  const res = await call(as, HttpMethod.get, `/board/workers/${user}`);
  expect(res.status).toBe(200);
  return res.json();
}
