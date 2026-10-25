import { PaymentBook, type Ports } from "@gigsync/core";
import type { Engagement, Payment, UserId } from "@gigsync/protocol";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadPayee, type Payee, selfId, workerJobs } from "./payments/store.js";

/** The screens of the app, in the order of the menu. */
export const Screen = {
  find: "find",
  requests: "requests",
  card: "card",
  today: "today",
  jobs: "jobs",
  pay: "pay",
  record: "record",
  agent: "agent",
  settings: "settings",
} as const;
export type Screen = (typeof Screen)[keyof typeof Screen];

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
