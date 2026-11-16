import {
  BoardProfile,
  type BoardProfileInput,
  type BoardQueryInput,
  BoardResult,
  type BoardSkill,
  BoardSkills,
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
  type FindEvent,
  type GeoPlace,
  GeoResult,
  ListedRates,
  type ListedRatesQueryInput,
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
  type PushAddress,
  PushKey,
  type QrCode,
  QrPerson,
  RecommendLink,
  type RecommendRequest,
  ServedCities,
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
import { ApiPath } from "./paths.js";

export { REQUEST_TIMEOUT_MS } from "./deadline.js";
export { HttpError, NetError, NetReason } from "./errors.js";
export { ApiPath };

/** What the mail transport needs from the server. ApiClient implements it; tests can use an in-memory relay. */
export interface Relay {
  directory(user: UserId): Promise<DirectoryEntry>;
  deliver(envelope: Envelope): Promise<unknown>;
  inbox(): Promise<Envelope[]>;
  ack(ids: MessageId[]): Promise<unknown>;
  /** Claims an engagement for this device in its owner's mailbox; returns the device that holds it (ADR 0045). */
  claim(engagement: EngagementId): Promise<DeviceId>;
}

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
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

  /** Revokes this device and its session on the server: messages stop being sealed to it. */
  async signOut(): Promise<void> {
    await this.call(HttpMethod.post, ApiPath.signOut);
  }

  /** The cities and areas GigSync serves (ADR 0061), and whether it lets every place in (`LIVE_CITIES=*`). */
  async cities(): Promise<ServedCities> {
    return ServedCities.parse(await this.call(HttpMethod.get, ApiPath.cities));
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

  publishProfile(profile: BoardProfileInput): Promise<unknown> {
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

  /** What workers near a place list for a skill: a range from three workers up (ADR 0057). */
  async listedRates(query: ListedRatesQueryInput): Promise<ListedRates> {
    const params = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]));
    return ListedRates.parse(await this.call(HttpMethod.get, `${ApiPath.boardRates}?${params}`));
  }

  /** One more of an event in Find's daily counts (ADR 0060): no user, no words. */
  async countFind(event: FindEvent): Promise<void> {
    await this.call(HttpMethod.post, ApiPath.findCount, { event });
  }

  async boardSkills(): Promise<BoardSkill[]> {
    return BoardSkills.parse(await this.call(HttpMethod.get, ApiPath.boardSkills)).skills;
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

  /** Blocks `user` for the caller; with `blocked` false, lifts the caller's own block of them. */
  blockMentor(user: UserId, blocked = true): Promise<unknown> {
    return this.call(HttpMethod.post, blocked ? ApiPath.mentorBlock : ApiPath.mentorUnblock, { user });
  }

  /** Tells the directory this device speaks `protocol` now, after an app update. */
  raiseProtocol(protocol: number): Promise<unknown> {
    return this.call(HttpMethod.put, ApiPath.deviceProtocol, { protocol });
  }

  /** The key a browser subscribes to pushes with, and whether the Android app's alerts can go (ADR 0067). */
  async pushKey(): Promise<PushKey> {
    return PushKey.parse(await this.call(HttpMethod.get, ApiPath.pushKey));
  }

  /**
   * Tells the API where this device takes alerts: a browser's push address and the keys to encrypt them to (only a real
   * push service's address is kept), or the Android app's FCM token and its language (ADR 0067).
   */
  async subscribePush(subscription: PushAddress): Promise<void> {
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

  async searchPlaces(q: string, near?: Place): Promise<GeoPlace[]> {
    const b = near && coarsePoint(near); // Typed words, favouring a city's centre: coarse, as every point sent.
    const params = new URLSearchParams({ q, ...(b && { lat: String(b.lat), lon: String(b.lon) }) });
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

  async recommendWorker(worker: UserId): Promise<RecommendLink> {
    const asked: RecommendRequest = { worker };
    return RecommendLink.parse(await this.call(HttpMethod.post, ApiPath.qrRecommend, asked));
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
