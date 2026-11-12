import { loadPayee, log, type Ports } from "@gigsync/core";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** Between the UPI ID and where to change it. */
const PARTS = " · ";

/**
 * The worker's UPI ID under their money (design W15), and the way to About me to change it, or to add one when none is
 * saved. Read from this phone each time the tab opens; it never leaves it (ADR 0011).
 */
export function UpiLine({ ports, onChange }: { ports: Ports; onChange: () => void }) {
  const { t } = useI18n();
  /** The saved UPI ID; null once the phone said there is none, undefined until it answered. */
  const [vpa, setVpa] = useState<string | null>();

  useEffect(() => {
    let live = true;
    loadPayee(ports.storage)
      .then((payee) => {
        if (live) setVpa(payee?.vpa ?? null);
      })
      .catch((err: unknown) => log.warn("loading payee failed", { error: err instanceof Error ? err.name : "" }));
    return () => {
      live = false;
    };
  }, [ports]);

  // Until the store has answered, say nothing: a line that flashes "none saved" first is wrong for a moment.
  if (vpa === undefined) return null;
  return (
    <p className="upi-line fine">
      {vpa ? t("ledger.upi_line", { vpa }) : t("ledger.upi_none")}
      {PARTS}
      <button type={C.button} className={C.linkBtn} onClick={onChange}>
        {t(vpa ? "ledger.upi_change" : "ledger.upi_add")}
      </button>
    </p>
  );
}
