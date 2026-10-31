import {
  autoTick,
  currentJourney,
  type JobRecord,
  type Journey,
  journeyId,
  type LoadedGuide,
  loadGuide,
  log,
  type Ports,
  removeJourney,
  type StartProblem,
  saveJourney,
  startJourney,
} from "@gigsync/core";
import { useCallback, useEffect, useState } from "react";
import { type Account, apiClient } from "../../adapters/account.js";

/** What the owner picked to start a move. */
export interface MovePicks {
  city: string;
  arrival: string;
  trade: string;
}

/** The landing screens' state: the owner's move and its city's guide, each undefined while loading, null when none. */
export interface LandingState {
  journey: Journey | null | undefined;
  guide: LoadedGuide | null | undefined;
  start: (picks: MovePicks) => Promise<StartProblem | undefined>;
  /** Saves a change the core made to the move (a tick, a step). */
  change: (next: Journey) => Promise<void>;
  remove: () => Promise<void>;
}

const failed = (what: string) => (err: unknown) =>
  log.warn(what, { error: err instanceof Error ? err.message : String(err) });

/**
 * Glue between the landing screens and the core: reads the owner's move from the phone, fetches its city's guide (or
 * the copy on the phone), and lets the app tick "first job" when a job both signed in the city is on the phone.
 */
export function useLanding(ports: Ports, account: Account, jobs: readonly JobRecord[]): LandingState {
  const owner = account.session.user;
  const session = account.session;
  const [journey, setJourney] = useState<Journey | null>();
  const [guide, setGuide] = useState<LoadedGuide | null>();
  const city = journey?.city;

  useEffect(() => {
    let live = true;
    currentJourney(ports.storage, owner)
      .then((j) => live && setJourney(j ?? null))
      .catch(failed("move not read"));
    return () => {
      live = false;
    };
  }, [ports, owner]);

  useEffect(() => {
    if (!city) return;
    let live = true;
    setGuide(undefined);
    const fetchGuide = (c: typeof city) => apiClient(session).cityGuide(c);
    loadGuide(ports.storage, fetchGuide, city, ports.clock.now())
      .then((g) => live && setGuide(g ?? null))
      .catch(failed("guide not read"));
    return () => {
      live = false;
    };
  }, [ports, session, city]);

  const change = useCallback(
    async (next: Journey) => {
      setJourney(next);
      await saveJourney(ports.storage, next);
    },
    [ports],
  );

  // A job both signed in the city ticks "first job"; the owner's untick stays.
  useEffect(() => {
    if (!journey) return;
    const next = autoTick(journey, jobs);
    if (next !== journey) change(next).catch(failed("move not saved"));
  }, [journey, jobs, change]);

  const start = useCallback(
    async (picks: MovePicks) => {
      const now = ports.clock.now();
      const started = startJourney({ ...picks, id: journeyId(now), owner, now });
      if (typeof started === "string") return started;
      await change(started);
      return undefined;
    },
    [ports, owner, change],
  );

  const remove = useCallback(async () => {
    if (!journey) return;
    await removeJourney(ports.storage, journey);
    setJourney(null);
    setGuide(undefined);
  }, [ports, journey]);

  return { journey, guide, start, change, remove };
}
