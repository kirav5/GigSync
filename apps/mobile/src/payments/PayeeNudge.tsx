import { loadPayee, log, type Ports } from "@gigsync/core";
import { EngagementStatus, Role } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import type { GigView } from "../useGig.js";

const E = EngagementStatus.enum;
/** Signed and not yet finished: payment is coming, so the UPI ID should be in place before the customer pays. */
const SIGNED: ReadonlySet<EngagementStatus> = new Set([E.agreed, E.in_progress, E.delivered, E.revision]);

/**
 * Today's reminder to add a UPI ID, once a deal is signed and none is saved. It never blocks anything: it only saves
 * the worker finding out with the customer standing there.
 */
export function PayeeNudge({ ports, view, onAdd }: { ports: Ports; view: GigView; onAdd: () => void }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState<boolean>();
  const signed = view.jobs.some((j) => j.engagement.role === Role.enum.provider && SIGNED.has(j.engagement.status));

  // Read each time Today opens (coming back from About me included) and when the first signed deal appears.
  useEffect(() => {
    if (!signed) return;
    let live = true;
    loadPayee(ports.storage)
      .then((payee) => {
        if (live) setSaved(payee !== undefined);
      })
      .catch((err: unknown) => log.warn("loading payee failed", { error: err instanceof Error ? err.message : "" }));
    return () => {
      live = false;
    };
  }, [ports, signed]);

  // Until the store has answered, say nothing: a nudge that flashes and vanishes is worse than none.
  if (!signed || saved !== false) return null;
  return (
    <div className={C.cardWait}>
      <p className={C.muted}>{t("money.nudge")}</p>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={onAdd}>
          {t("money.add_upi")}
        </button>
      </div>
    </div>
  );
}
