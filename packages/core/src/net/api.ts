import {
  BoardProfile,
  type BoardQueryInput,
  BoardResult,
  type BoardWorker,
  type City,
  CityGuide,
  Claim,
  type ClaimRequest,
  coarsePoint,
  type DeviceId,
  type DeviceRegistration,
  DirectoryEntry,
  type EngagementId,
  Envelope,
  type EstimateRequest,
  EstimateResponse,
  type GeoPlace,
  GeoResult,
  type MatchRequestInput,
  MatchResponse,
  type MentorListingInput,
  type MentorProfile,
  type MentorReport,
  MessageId,
  MyMentorListing,
  MyQr,
  type MyQrRequest,
  type Place,
  PushKey,
  type PushSubscribe,
  type QrCode,
  QrPerson,
  Session,
  type UserId,
} from "@gigsync/protocol";
import { z } from "zod";
import type { EstimateApi } from "../estimate/lookup.js";
import { BEARER_PREFIX, ContentType, Header, HttpMethod } from "../http.js";
import { log } from "../log.js";
import type { MentorApi } from "../mentor/types.js";
import type { QrApi } from "../qr/types.js";
import { REQUEST_TIMEOUT_MS, withDeadline } from "./deadline.js";
import { HttpError } from "./errors.js";

/** The routes of workers/api this client calls. */
export const ApiPath = {
  otpRequest: "/v1/auth/otp/request",
  otpVerify: "/v1/auth/otp/verify",
  directory: "/v1/directory/",
  mailbox: "/v1/mailbox/",
  inbox: "/v1/inbox",
  ack: "/v1/inbox/ack",
  /** Which of my devices answers an engagement (ADR 0045): `POST /v1/inbox/claims`. */
  claims: "/v1/inbox/claims",
  boardProfile: "/v1/board/profile",
  boardWorkers: "/v1/board/workers",
  mentorMe: "/v1/mentors/me",
  mentorMatch: "/v1/mentors/match",
  mentorReport: "/v1/mentors/report",
  mentorBlock: "/v1/mentors/block",
  /** A city's guide for the landing journey: `GET /v1/content/:city`. */
  content: "/v1/content/",
  /** This device now speaks a newer protocol: `PUT /v1/devices/me/protocol`. */
  deviceProtocol: "/v1/devices/me/protocol",
  /** Where this device's browser takes pushes: `PUT` keeps it, `DELETE` turns alerts off. */
  devicePush: "/v1/devices/me/push",
  /** The API's public VAPID key to subscribe with: `GET /v1/devices/push-key`. */
  pushKey: "/v1/devices/push-key",
  /** The usual range for a job (ADR 0030): `POST /v1/estimates`. */
  estimates: "/v1/estimates",
  /** ADR 0045: a coarse point, or typed words, to places (locality, city, PIN). */
  geoReverse: "/v1/geo/reverse",
  geoSearch: "/v1/geo/search",
  /** One agreed price shared anonymously: `POST /v1/estimates/prices`. */
  /** The caller's personal QR (ADR 0034): `PUT` gets or makes it, `/replace` makes a new one. */
  qrMe: "/v1/qr/me",
  qrReplace: "/v1/qr/me/replace",
  /** `GET /v1/qr/:code` looks a code up; `POST /v1/qr/:code/offer` takes an offer to work through it. */
  qr: "/v1/qr/",
  qrOffer: "/offer",
} as const;

export { REQUEST_TIMEOUT_MS } from "./deadline.js";
export { HttpError, NetError, NetReason } from "./errors.js";

/** What the mail transport needs from the server. ApiClient implements it; tests can use an in-memory relay. */
export interface Relay {
  directory(user: UserId): Promise<DirectoryEntry>;
  deliver(envelope: Envelope): Promise<unknown>;
  inbox(): Promise<Envelope[]>;
  ack(ids: MessageId[]): Promise<unknown>;
  /** Claims an engagement for this device in its owner's mailbox; returns the device that holds it (ADR 0045). */
  claim(engagement: EngagementId): Promise<DeviceId>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
const ErrorBody = z.object({ error: z.string() });
const Removed = z.object({ removed: z.boolean() });
/** Just enough of an envelope this phone cannot read to acknowledge it. */
const Identified = z.object({ id: MessageId });

/** Typed calls to workers/api. Every response is parsed with its protocol schema before it is used. */
export class ApiClient implements Relay, MentorApi, EstimateApi, QrApi {
  constructor(
    private readonly base: string,
    private readonly fetchFn: Fetch = (input, init) => fetch(input, init),
    private readonly session?: Session,
  ) {}

  /** The same client, acting as a signed-in device. */
  as(session: Session): ApiClient {
    return new ApiClient(this.base, this.fetchFn, session);
  }

  async requestOtp(phone: string): Promise<void> {
    await this.call(HttpMethod.post, ApiPath.otpRequest, { phone });
  }

  async verifyOtp(phone: string, code: string, device: DeviceRegistration): Promise<Session> {
    return Session.parse(await this.call(HttpMethod.post, ApiPath.otpVerify, { phone, code, device }));
  }

  async directory(user: UserId): Promise<DirectoryEntry> {
    return DirectoryEntry.parse(await this.call(HttpMethod.get, `${ApiPath.directory}${user}`));
  }

  deliver(envelope: Envelope): Promise<unknown> {
    return this.call(HttpMethod.post, `${ApiPath.mailbox}${envelope.to.user}`, envelope);
  }

  /**
   * What the mailbox holds, envelope by envelope: one this phone cannot read (a kind from a newer app) is skipped and
   * acknowledged here, so it neither blocks the others nor comes back.
   */
  async inbox(): Promise<Envelope[]> {
    const fetched = z.array(z.unknown()).parse(await this.call(HttpMethod.get, ApiPath.inbox));
    const readable: Envelope[] = [];
    const unreadable: MessageId[] = [];
    for (const raw of fetched) {
      const parsed = Envelope.safeParse(raw);
      if (parsed.success) {
        readable.push(parsed.data);
        continue;
      }
      const id = Identified.safeParse(raw).data?.id;
      log.warn("unreadable envelope skipped", { messageId: id });
      if (id) unreadable.push(id);
    }
    if (unreadable.length > 0) await this.ackUnreadable(unreadable);
    return readable;
  }

  /** A failed acknowledgement only means the skipped envelopes come back once more; the readable ones still go on. */
  private async ackUnreadable(ids: MessageId[]): Promise<void> {
    try {
      await this.ack(ids);
    } catch (err) {
      log.warn("ack of unreadable envelopes failed", {
        count: ids.length,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  ack(ids: MessageId[]): Promise<unknown> {
    return this.call(HttpMethod.post, ApiPath.ack, { ids });
  }

  async claim(engagement: EngagementId): Promise<DeviceId> {
    return Claim.parse(await this.call(HttpMethod.post, ApiPath.claims, { engagement } satisfies ClaimRequest)).owner;
  }

  publishProfile(profile: BoardProfile): Promise<unknown> {
    return this.call(HttpMethod.put, ApiPath.boardProfile, profile);
  }

  async removeProfile(): Promise<boolean> {
    return Removed.parse(await this.call(HttpMethod.delete, ApiPath.boardProfile)).removed;
  }

  /** One worker's card as the board serves it (record capped); undefined when they are not on the board. */
  async workerCard(user: UserId): Promise<BoardProfile | undefined> {
    try {
      return BoardProfile.parse(await this.call(HttpMethod.get, `${ApiPath.boardWorkers}/${user}`));
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) return undefined;
      throw err;
    }
  }

  async searchWorkers(query: BoardQueryInput): Promise<BoardWorker[]> {
    const params = new URLSearchParams(
      Object.entries(query)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    );
    return BoardResult.parse(await this.call(HttpMethod.get, `${ApiPath.boardWorkers}?${params}`)).workers;
  }

  async publishMentor(listing: MentorListingInput): Promise<MyMentorListing> {
    return MyMentorListing.parse(await this.call(HttpMethod.put, ApiPath.mentorMe, listing));
  }

  /** Answers 204 whether or not a listing was there: either way the owner is off the list. */
  async removeMentor(): Promise<void> {
    await this.call(HttpMethod.delete, ApiPath.mentorMe);
  }

  async matchMentors(query: MatchRequestInput): Promise<MentorProfile[]> {
    return MatchResponse.parse(await this.call(HttpMethod.post, ApiPath.mentorMatch, query)).mentors;
  }

  reportMentor(report: MentorReport): Promise<unknown> {
    return this.call(HttpMethod.post, ApiPath.mentorReport, report);
  }

  blockMentor(user: UserId): Promise<unknown> {
    return this.call(HttpMethod.post, ApiPath.mentorBlock, { user });
  }

  /** Tells the directory this device speaks `protocol` now, after an app update. */
  raiseProtocol(protocol: number): Promise<unknown> {
    return this.call(HttpMethod.put, ApiPath.deviceProtocol, { protocol });
  }

  /** The key to subscribe to pushes with, or undefined while push is not set up on the API. */
  async pushKey(): Promise<string | undefined> {
    return PushKey.parse(await this.call(HttpMethod.get, ApiPath.pushKey)).public_key;
  }

  /**
   * Tells the API where this device's browser takes pushes and the keys to encrypt them to; only a real push service's
   * address is kept.
   */
  async subscribePush(subscription: PushSubscribe): Promise<void> {
    await this.call(HttpMethod.put, ApiPath.devicePush, subscription);
  }

  async unsubscribePush(): Promise<void> {
    await this.call(HttpMethod.delete, ApiPath.devicePush);
  }

  /** The usual range for a job, or why there is none ("no estimate" is an answer, not an error). */
  async estimate(request: EstimateRequest): Promise<EstimateResponse> {
    return EstimateResponse.parse(await this.call(HttpMethod.post, ApiPath.estimates, request));
  }

  /** The places at a point, which is rounded to the coarse grid here, before it leaves the phone (ADR 0045). */
  async reverseGeocode(point: Place): Promise<GeoPlace[]> {
    const p = coarsePoint(point);
    const params = new URLSearchParams({ lat: String(p.lat), lon: String(p.lon) });
    return GeoResult.parse(await this.call(HttpMethod.get, `${ApiPath.geoReverse}?${params}`)).places;
  }

  /** Places matching what the owner typed. */
  async searchPlaces(q: string): Promise<GeoPlace[]> {
    const params = new URLSearchParams({ q });
    return GeoResult.parse(await this.call(HttpMethod.get, `${ApiPath.geoSearch}?${params}`)).places;
  }

  /** A city's guide, checked against its schema before the landing journey keeps it. */
  async cityGuide(city: City): Promise<CityGuide> {
    return CityGuide.parse(await this.call(HttpMethod.get, `${ApiPath.content}${city}`));
  }

  async myQr(owner: MyQrRequest): Promise<MyQr> {
    return MyQr.parse(await this.call(HttpMethod.put, ApiPath.qrMe, owner));
  }

  async replaceQr(owner: MyQrRequest): Promise<MyQr> {
    return MyQr.parse(await this.call(HttpMethod.post, ApiPath.qrReplace, owner));
  }

  async lookupQr(code: QrCode): Promise<QrPerson> {
    return QrPerson.parse(await this.call(HttpMethod.get, `${ApiPath.qr}${code}`));
  }

  async takeOffer(code: QrCode): Promise<void> {
    await this.call(HttpMethod.post, `${ApiPath.qr}${code}${ApiPath.qrOffer}`);
  }

  protected async call(method: string, path: string, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = { [Header.contentType]: ContentType.json };
    if (this.session) headers[Header.authorization] = `${BEARER_PREFIX}${this.session.token}`;
    const init: RequestInit = { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) };
    const { res, json } = await withDeadline(REQUEST_TIMEOUT_MS, async (signal) => {
      const res = await this.fetchFn(`${this.base}${path}`, { ...init, signal });
      const json: unknown = await res.json().catch(() => null);
      return { res, json };
    });
    if (!res.ok) throw new HttpError(res.status, ErrorBody.safeParse(json).data?.error ?? res.statusText);
    return json;
  }
}
