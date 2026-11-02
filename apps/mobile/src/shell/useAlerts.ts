import type { JobRecord } from "@gigsync/core";
import type { Lang, Session } from "@gigsync/protocol";
import { useEffect, useMemo } from "react";
import { refreshAlerts, setOfferSession, tellNames } from "../adapters/push.js";

/**
 * Notifications: each open tells the API this device's push address again and the service worker the owner's
 * language (adapters/push.ts), and the first tap that starts a job's news may offer them. As jobs come and go, the
 * service worker learns the names of the people they are with, so a notification can say who it is from.
 */
export function useAlerts(
  session: Session,
  lang: Lang,
  jobs: readonly JobRecord[],
  names: Readonly<Record<string, string>>,
): void {
  useEffect(() => {
    setOfferSession(session);
    void refreshAlerts(session, lang);
    return () => setOfferSession(undefined);
  }, [session, lang]);

  const known = useMemo(() => {
    const out: Record<string, string> = {};
    for (const j of jobs) {
      const name = names[j.engagement.counterpart] || j.contact?.name || j.their_name;
      if (name) out[j.engagement.counterpart] = name;
    }
    return out;
  }, [jobs, names]);
  const key = JSON.stringify(known);
  // biome-ignore lint/correctness/useExhaustiveDependencies: told again only when a name changes, not on every sync
  useEffect(() => tellNames(known), [key]);
}
