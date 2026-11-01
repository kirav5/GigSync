import type { Session } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { AlertState, alertState, turnOffAlerts, turnOnAlerts } from "../adapters/push.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

/** What Settings says for each state that has no switch to offer. */
const STATE_LINE = {
  [AlertState.blocked]: "alerts.blocked",
  [AlertState.install]: "alerts.install",
  [AlertState.unsupported]: "alerts.unsupported",
  [AlertState.unavailable]: "alerts.unavailable",
} as const;

/**
 * Settings › Job alerts: a phone notification when a job moves on, for worker and household alike. The owner's tap
 * turns it on (the browser then asks once); the alert itself never says what was said (adapters/push.ts).
 */
export function AlertsSettings({ session }: { session: Session }) {
  const { t } = useI18n();
  const [state, setState] = useState<AlertState>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void alertState().then(setState);
  }, []);

  const flip = async (on: boolean) => {
    setBusy(true);
    try {
      setState(await (on ? turnOnAlerts(session) : turnOffAlerts(session)));
    } catch {
      setState(await alertState());
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  return (
    <section className={C.card} aria-label={t("alerts.title")}>
      <span className={C.label}>{t("alerts.title")}</span>
      <span className={C.faint}>{t("alerts.about")}</span>
      {state === AlertState.on && <span className={C.muted}>{t("alerts.on")}</span>}
      {state in STATE_LINE && <span className={C.muted}>{t(STATE_LINE[state as keyof typeof STATE_LINE])}</span>}
      {(state === AlertState.on || state === AlertState.off) && (
        <div>
          <button
            type={C.button}
            className={state === AlertState.on ? C.secondary : C.accent}
            disabled={busy}
            onClick={() => void flip(state === AlertState.off)}
          >
            {t(state === AlertState.on ? "alerts.turn_off" : "alerts.turn_on")}
          </button>
        </div>
      )}
    </section>
  );
}
