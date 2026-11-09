import type { DeviceId } from "@gigsync/protocol";
import type { LiveSession, SessionOwner } from "../db/sessions.js";

/**
 * How long this isolate trusts a session the directory vouched for. It is also the price: a session revoked, or an
 * account frozen, through another isolate may keep working here on the routes that use the cache for this long.
 */
export const SESSION_CACHE_TTL_MS = 60_000;
/** Most sessions one isolate remembers; past it the one remembered longest ago goes first. */
export const SESSION_CACHE_MAX = 5_000;

interface Remembered {
  owner: SessionOwner;
  /** The earlier of the TTL and the session's own end, so a remembered session never outlives its expiry. */
  until: number;
}

/**
 * Sessions the directory recently vouched for, by token, so an open phone's polling does not ask Postgres who it is
 * every few seconds. Only a yes is remembered, never a refusal. Every method takes the request's own clock.
 */
export class SessionCache {
  private readonly sessions = new Map<string, Remembered>();
  /** Devices revoked here, and until when a lookup that began before the revocation may not be remembered. */
  private readonly revoked = new Map<DeviceId, number>();

  constructor(
    private readonly ttlMs = SESSION_CACHE_TTL_MS,
    private readonly max = SESSION_CACHE_MAX,
  ) {}

  get size(): number {
    return this.sessions.size;
  }

  /** The owner of a remembered token, or undefined once its time is up. */
  get(token: string, now: number): SessionOwner | undefined {
    const hit = this.sessions.get(token);
    if (!hit) return undefined;
    if (hit.until > now) return hit.owner;
    this.sessions.delete(token);
    return undefined;
  }

  remember(token: string, session: LiveSession, now: number): void {
    if ((this.revoked.get(session.owner.device_id) ?? 0) > now) return;
    // Deleting first moves a token remembered again to the back of the queue.
    this.sessions.delete(token);
    if (this.sessions.size >= this.max) {
      const oldest = this.sessions.keys().next();
      if (!oldest.done) this.sessions.delete(oldest.value);
    }
    this.sessions.set(token, { owner: session.owner, until: Math.min(now + this.ttlMs, session.endsAt) });
  }

  forget(token: string): void {
    this.sessions.delete(token);
  }

  /**
   * Forgets every session of devices just revoked, so this isolate refuses them at once. A lookup already on its way
   * to Postgres may still come back with the old answer, so those devices are not remembered again for one TTL.
   * Revocations are rare and the cache is bounded, so one pass over it is cheap.
   */
  forgetDevices(devices: readonly DeviceId[], now: number): void {
    if (devices.length === 0) return;
    for (const [device, until] of this.revoked) if (until <= now) this.revoked.delete(device);
    const gone = new Set(devices);
    for (const device of gone) this.revoked.set(device, now + this.ttlMs);
    for (const [token, { owner }] of this.sessions) if (gone.has(owner.device_id)) this.sessions.delete(token);
  }

  /** Forgets everything, as a new isolate would start. */
  clear(): void {
    this.sessions.clear();
    this.revoked.clear();
  }
}

/** This isolate's sessions: module state lives as long as the isolate and is shared by its requests. */
export const sessionCache = new SessionCache();
