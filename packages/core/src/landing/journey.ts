import { City, JourneyStep, Role, Trade, type UserId } from "@gigsync/protocol";
import { ulid } from "ulid";
import type { JobRecord } from "../job/store.js";
import { distanceKm } from "../job/worker.js";
import { bothSigned } from "../payments/passbook.js";
import { FIRST_JOB_ITEM } from "./checklist.js";
import { CITY_AREA } from "./cities.js";

/**
 * One move to a new city, kept on this phone: where and when the owner arrives, their trade, which step of the move
 * they are on, and what they ticked. The steps go in order, and only the owner moves to the next one; the app may
 * tick an item it can see for itself (a job both sides signed in the new city), never move a step.
 */

/** Who ticked an item. */
export const TickBy = { owner: "owner", app: "app" } as const;
export type TickBy = (typeof TickBy)[keyof typeof TickBy];

export interface Journey {
  id: string;
  owner: UserId;
  city: City;
  /** The day the owner expects to arrive, `YYYY-MM-DD`. */
  arrival: string;
  trade: Trade;
  step: JourneyStep;
  /** Checklist items done, by item id, and who ticked each. */
  ticked: Record<string, TickBy>;
  /** Items the owner unticked after the app ticked them: the app does not tick them again. */
  cleared: string[];
  /** ISO time the move was started on this phone. */
  started_at: string;
}

const JOURNEY_PREFIX = "move_";
/** A new move's id: time-ordered, so the newest sorts last. */
export const journeyId = (now: Date): string => `${JOURNEY_PREFIX}${ulid(now.getTime())}`;

export interface JourneyStart {
  id: string;
  owner: UserId;
  city: string;
  arrival: string;
  trade: string;
  now: Date;
}

/** Why a move could not be started: what the owner picked is not something the app has. */
export const StartProblem = { city: "city", arrival: "arrival", trade: "trade" } as const;
export type StartProblem = (typeof StartProblem)[keyof typeof StartProblem];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Length of `YYYY-MM-DD` at the start of an ISO time. */
const DAY_LENGTH = 10;

/** True for a real calendar day written `YYYY-MM-DD` (not 2026-02-30). */
export function isDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  const at = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, DAY_LENGTH) === day;
}

const STEPS = JourneyStep.options;

/** A new move at its first step, or what is wrong with the owner's picks. */
export function startJourney(start: JourneyStart): Journey | StartProblem {
  const city = City.options.find((c) => c === start.city);
  if (!city) return StartProblem.city;
  if (!isDay(start.arrival)) return StartProblem.arrival;
  const trade = Trade.safeParse(start.trade);
  if (!trade.success) return StartProblem.trade;
  return {
    id: start.id,
    owner: start.owner,
    city,
    arrival: start.arrival,
    trade: trade.data,
    step: JourneyStep.enum.planning,
    ticked: {},
    cleared: [],
    started_at: start.now.toISOString(),
  };
}

/** The step after this one, or undefined at the last. */
export function nextStep(step: JourneyStep): JourneyStep | undefined {
  return STEPS[STEPS.indexOf(step) + 1];
}

/** The step before this one, or undefined at the first. */
export function previousStep(step: JourneyStep): JourneyStep | undefined {
  const at = STEPS.indexOf(step);
  return at > 0 ? STEPS[at - 1] : undefined;
}

/** The owner moves on to the next step, ticked or not: they know when they have arrived. */
export function advanceStep(journey: Journey): Journey {
  const step = nextStep(journey.step);
  return step ? { ...journey, step } : journey;
}

/** The owner goes back a step, to see or tick what they left. */
export function stepBack(journey: Journey): Journey {
  const step = previousStep(journey.step);
  return step ? { ...journey, step } : journey;
}

/** The owner ticks an item, or unticks it; an untick of the app's tick is remembered so the app leaves it. */
export function toggleItem(journey: Journey, item: string): Journey {
  const by = journey.ticked[item];
  if (by === undefined)
    return {
      ...journey,
      ticked: { ...journey.ticked, [item]: TickBy.owner },
      cleared: journey.cleared.filter((c) => c !== item),
    };
  const { [item]: _, ...rest } = journey.ticked;
  const cleared = by === TickBy.app ? [...journey.cleared, item] : journey.cleared;
  return { ...journey, ticked: rest, cleared };
}

/** True when this phone did the work in a job both sides signed, at a place inside the move's city. */
export function signedWorkIn(city: City, job: JobRecord): boolean {
  if (job.engagement.role !== Role.enum.provider || !bothSigned(job)) return false;
  const { centre, radius_km } = CITY_AREA[city];
  return distanceKm(centre, job.request.area) <= radius_km;
}

/** The app ticks "first job" once a job both sides signed in the new city is on this phone, unless the owner cleared it. */
export function autoTick(journey: Journey, jobs: readonly JobRecord[]): Journey {
  const item = FIRST_JOB_ITEM;
  if (journey.ticked[item] !== undefined || journey.cleared.includes(item)) return journey;
  if (!jobs.some((job) => signedWorkIn(journey.city, job))) return journey;
  return { ...journey, ticked: { ...journey.ticked, [item]: TickBy.app } };
}
