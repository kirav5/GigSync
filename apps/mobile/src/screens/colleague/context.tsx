import { type Colleague, ColleagueState, type GigDevice, log, type Ports } from "@gigsync/core";
import type { EngagementId, UserId } from "@gigsync/protocol";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { answerReferral, type ReferralAnswer, referralAnswers, rememberName } from "../../adapters/account.js";

/** What the colleague screens and the referral parts of a job card read, kept in step with the sync loop. */
export interface ColleagueView {
  /** Workers linked in person, and those asked who have not answered yet. */
  colleagues: readonly Colleague[];
  /** Notes from colleagues not shown yet, all together. */
  unread: number;
  /** What the owner said to each colleague suggestion, by job. */
  answers: ReadonlyMap<EngagementId, ReferralAnswer>;
  /** Reads everything again now, after a change made here. */
  refresh: () => void;
  answer: (job: EngagementId, answer: ReferralAnswer) => Promise<void>;
  /** Keeps a suggested colleague's name, so the job asked of them shows who it is. */
  remember: (user: UserId, name: string) => Promise<void>;
}

const NONE: ColleagueView = {
  colleagues: [],
  unread: 0,
  answers: new Map(),
  refresh: () => undefined,
  answer: async () => undefined,
  remember: async () => undefined,
};

const ColleagueContext = createContext<ColleagueView>(NONE);

export const linkedOnly = (colleagues: readonly Colleague[]) =>
  colleagues.filter((c) => c.state === ColleagueState.linked);

/**
 * Reads the phone's colleagues and referral answers after every sync (`syncedAt`, which the sync loop moves) and after
 * every change made here, for the screens below it.
 */
export function ColleagueProvider({
  ports,
  device,
  syncedAt,
  children,
}: {
  ports: Ports;
  device: GigDevice;
  syncedAt: Date | undefined;
  children: ReactNode;
}) {
  const [colleagues, setColleagues] = useState<readonly Colleague[]>([]);
  const [answers, setAnswers] = useState<ReadonlyMap<EngagementId, ReferralAnswer>>(new Map());
  const [asked, setAsked] = useState(0);
  const refresh = useCallback(() => setAsked((n) => n + 1), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `syncedAt` and `asked` only exist to read again.
  useEffect(() => {
    let live = true;
    const failed = (err: unknown) =>
      log.warn("colleagues not read", { error: err instanceof Error ? err.message : String(err) });
    device.colleagues.list().then((list) => {
      if (live) setColleagues(list);
    }, failed);
    referralAnswers(ports).then((said) => {
      if (live) setAnswers(said);
    }, failed);
    return () => {
      live = false;
    };
  }, [ports, device, syncedAt, asked]);

  const value = useMemo<ColleagueView>(
    () => ({
      colleagues,
      unread: colleagues.reduce((n, c) => n + c.unread, 0),
      answers,
      refresh,
      answer: async (job, said) => {
        await answerReferral(ports, job, said);
        refresh();
      },
      remember: (user, name) => rememberName(ports, user, name),
    }),
    [ports, colleagues, answers, refresh],
  );
  return <ColleagueContext.Provider value={value}>{children}</ColleagueContext.Provider>;
}

export function useColleagues(): ColleagueView {
  return useContext(ColleagueContext);
}
