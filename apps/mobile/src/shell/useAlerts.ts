import type { Lang, Session } from "@gigsync/protocol";
import { useEffect } from "react";
import { refreshAlerts } from "../adapters/push.js";

/**
 * With job alerts on, each open tells the API this device's push address again and the service worker the owner's
 * language for the alert's words (adapters/push.ts). Nothing happens on a device without alerts.
 */
export function useAlerts(session: Session, lang: Lang): void {
  useEffect(() => {
    void refreshAlerts(session, lang);
  }, [session, lang]);
}
