import { PaymentBook, type Ports } from "@gigsync/core";
import type { Engagement, Payment, UserId } from "@gigsync/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPayee, type Payee, selfId, workerJobs } from "./payments/store.js";

/** The screens of the app: each role's tabs, and My card under Profile. */
export const Screen = {
  find: "find",
  requests: "requests",
  today: "today",
  talk: "talk",
  passbook: "passbook",
  profile: "profile",
  card: "card",
  // The manual flow's screens, removed with it.
  jobs: "jobs",
  pay: "pay",
  record: "record",
} as const;
export type Screen = (typeof Screen)[keyof typeof Screen];

/** The worker's card: none yet, made but off the board, or on the board. */
export const CardState = { none: "none", off: "off", on: "on" } as const;
export type CardState = (typeof CardState)[keyof typeof CardState];

export interface GigData {
  ready: boolean;
  self?: UserId;
  payee?: Payee;
  jobs: Engagement[];
  payments: Payment[];
}

/** Everything the worker's screens show, read from this phone, plus a reload after any change. */
export function useGigData(ports: Ports) {
  const book = useMemo(() => new PaymentBook(ports.storage, ports.clock), [ports]);
  const [data, setData] = useState<GigData>({ ready: false, jobs: [], payments: [] });

  const reload = useCallback(async () => {
    const [self, payee, jobs, payments] = await Promise.all([
      selfId(ports.storage),
      loadPayee(ports.storage),
      workerJobs(ports.storage),
      book.all(),
    ]);
    setData({ ready: true, self, ...(payee ? { payee } : {}), jobs, payments });
  }, [ports, book]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...data, book, reload };
}
