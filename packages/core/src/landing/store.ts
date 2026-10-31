import { type City, CityGuide, type UserId } from "@gigsync/protocol";
import { log } from "../log.js";
import { Collection, type Storage } from "../ports.js";
import type { Journey } from "./journey.js";

/** This owner's move under way: the newest one they started on this phone, or undefined. */
export async function currentJourney(storage: Storage, owner: UserId): Promise<Journey | undefined> {
  const mine = (await storage.list<Journey>(Collection.journeys)).filter((j) => j.owner === owner);
  return mine.sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
}

export function saveJourney(storage: Storage, journey: Journey): Promise<void> {
  return storage.put(Collection.journeys, journey.id, journey);
}

/** The owner removes a move: started by mistake, or done with. */
export function removeJourney(storage: Storage, journey: Journey): Promise<void> {
  return storage.delete(Collection.journeys, journey.id);
}

/** A guide as kept on the phone, with when it was downloaded. */
interface SavedGuide {
  guide: CityGuide;
  /** ISO time it was downloaded. */
  at: string;
}

/** A city's guide and where it came from: just downloaded, or the copy on this phone. */
export interface LoadedGuide {
  guide: CityGuide;
  /** ISO time this copy was downloaded. */
  at: string;
  /** True when the API could not be reached and this is the copy kept on the phone. */
  offline: boolean;
}

/** The copy on this phone, if it still fits the schema: one saved by an older app may not. */
async function keptGuide(storage: Storage, city: City): Promise<SavedGuide | undefined> {
  const kept = await storage.get<SavedGuide>(Collection.guides, city);
  const guide = CityGuide.safeParse(kept?.guide);
  return kept && guide.success ? { guide: guide.data, at: kept.at } : undefined;
}

/** The city's guide as kept on this phone, without asking the API: for screens that only read it (mentors' helplines). */
export async function savedGuide(storage: Storage, city: City): Promise<CityGuide | undefined> {
  return (await keptGuide(storage, city))?.guide;
}

/** Fetches one city's guide from the API, already checked against its schema. */
export type FetchGuide = (city: City) => Promise<CityGuide>;

/** How old a kept guide may be before the phone asks the API for a newer one: a draft changes, but not hourly. */
export const GUIDE_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * The city's guide: the phone's copy when it is fresh, else a new download (kept for next time), else the phone's
 * older copy when the API cannot be reached; undefined only when it was never downloaded and cannot be now.
 */
export async function loadGuide(
  storage: Storage,
  fetchGuide: FetchGuide,
  city: City,
  now: Date,
): Promise<LoadedGuide | undefined> {
  const kept = await keptGuide(storage, city);
  if (kept && now.getTime() - new Date(kept.at).getTime() < GUIDE_FRESH_MS) return { ...kept, offline: false };
  try {
    const guide = await fetchGuide(city);
    const saved: SavedGuide = { guide, at: now.toISOString() };
    await storage.put(Collection.guides, city, saved);
    return { ...saved, offline: false };
  } catch (err) {
    log.warn("city guide not downloaded", { city, error: err instanceof Error ? err.message : String(err) });
    return kept ? { ...kept, offline: true } : undefined;
  }
}
