import type { Session } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { isAndroidApp } from "../adapters/nativePush.js";
import { AlertState, alertState, turnOffAlerts, turnOnAlerts } from "../adapters/push.js";
import { useI18n } from "../i18n.js";
import { ListCard, ListRow } from "../ui/ListRow.js";
import { ToggleRow } from "./pages/ToggleRow.js";

/** What Settings says for each state that has no switch to offer. */
const STATE_LINE = {
  [AlertState.blocked]: "alerts.blocked",
  [AlertState.install]: "alerts.install",
  [AlertState.unsupported]: "alerts.unsupported",
  [AlertState.unavailable]: "alerts.unavailable",
} as const;
/** In the Android app the alert says only "something new" (ADR 0067), and a no is undone in the phone's settings. */
const APP_LINE = { [AlertState.blocked]: "alerts.blocked_app" } as const;

/**
 * Settings › Alerts: a phone notification when a job moves on, for worker and household alike, as one switch. The
 * owner's tap turns it on (the browser then asks once); the alert itself never says what was said (adapters/push.ts).
 * Where there can be no switch (blocked, not installed, no support), the row says why instead. Nothing here promises a
 * call: GigSync never rings anyone.
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
  const title = t("me.alerts_job");
  const on = state === AlertState.on;
  const app = isAndroidApp();
  const about = app ? "alerts.about_app" : "alerts.about";
  const lineOf = (s: keyof typeof STATE_LINE) => (app && s === AlertState.blocked ? APP_LINE[s] : STATE_LINE[s]);
  return (
    <ListCard label={t("me.section_alerts")}>
      {state === AlertState.on || state === AlertState.off ? (
        <ToggleRow
          title={title}
          sub={t(on ? "alerts.on" : about)}
          checked={on}
          onChange={(next) => void flip(next)}
          disabled={busy}
        />
      ) : (
        <ListRow icon="bell" title={title} sub={t(lineOf(state))} />
      )}
    </ListCard>
  );
}
