import {
  type GigDevice,
  type Introduction,
  log,
  type NewcomerPrefs,
  type ReceivedRequest,
  type SentRequest,
} from "@gigsync/core";
import { useCallback, useEffect, useState } from "react";

/** What the mentor parts of Today and Find a mentor show, read from this phone. */
export interface MentorView {
  /** Landing requests waiting for this owner's yes or no, as a mentor. */
  incoming: ReceivedRequest[];
  /** This owner's own requests, as a newcomer, with the mentors' answers. */
  requests: SentRequest[];
  /** Introductions waiting for an answer. */
  intros: Introduction[];
  prefs: NewcomerPrefs;
  /** Reads everything again now, after a change made here. */
  refresh: () => void;
}

const EMPTY = { incoming: [], requests: [], intros: [], prefs: {} };

/** Reads the phone's mentor state after every sync (`syncedAt` moves) and after every change made here. */
export function useMentors(device: GigDevice, syncedAt: Date | undefined): MentorView {
  const [view, setView] = useState<Omit<MentorView, "refresh">>(EMPTY);
  const [asked, setAsked] = useState(0);
  const refresh = useCallback(() => setAsked((n) => n + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `syncedAt` and `asked` only exist to read again.
  useEffect(() => {
    let live = true;
    const m = device.mentors;
    Promise.all([m.incoming(), m.requests(), m.intros(), m.newcomer()]).then(
      ([incoming, requests, intros, prefs]) => {
        if (live) setView({ incoming, requests, intros, prefs });
      },
      (err: unknown) => log.warn("mentors not read", { error: err instanceof Error ? err.message : String(err) }),
    );
    return () => {
      live = false;
    };
  }, [device, syncedAt, asked]);

  return { ...view, refresh };
}
