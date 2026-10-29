import { chipChoice, type Ports, readScope, type ScopeChip } from "@gigsync/core";
import type { Trade } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/**
 * Find's form: the scope read from the owner's description (ADR 0033 §5), as chips to remove or confirm. Nothing read
 * counts until the owner taps "Yes, that's right"; then `onConfirm` hands the rest to the form for the estimate and
 * the request. A new description, or another trade, reads again.
 */
export function ScopeChips({
  ports,
  trade,
  text,
  onConfirm,
}: {
  ports: Ports;
  trade: Trade;
  text: string;
  onConfirm: (chips: readonly ScopeChip[] | undefined) => void;
}) {
  const { lang, t } = useI18n();
  const [chips, setChips] = useState<readonly ScopeChip[]>([]);
  const [reading, setReading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let live = true;
    setConfirmed(false);
    onConfirm(undefined);
    if (!text) return setChips([]);
    setReading(true);
    void readScope(ports.model, text, { trade, lang }).then((read) => {
      if (!live) return;
      setChips(read);
      setReading(false);
    });
    return () => {
      live = false;
    };
  }, [ports, trade, text, lang, onConfirm]);

  if (reading)
    return (
      <p className={C.muted} role="status">
        {t("terms.reading")}
      </p>
    );
  if (chips.length === 0) return null;
  const confirm = () => {
    setConfirmed(true);
    onConfirm(chips);
  };
  return (
    <fieldset className={C.stack} aria-label={t("terms.scope_read")}>
      <span className={C.muted}>{t("terms.scope_read")}</span>
      <div className={C.row}>
        {chips.map((chip) => {
          const c = chipChoice(lang, chip);
          return (
            <button
              key={chip.key}
              type={C.button}
              className={C.chipOn}
              aria-pressed={true}
              disabled={confirmed}
              onClick={() => setChips((all) => all.filter((x) => x.key !== chip.key))}
            >
              {t(c.key, c.params)}
            </button>
          );
        })}
        {!confirmed && (
          <button type={C.button} className={C.secondary} onClick={confirm}>
            {t("terms.scope_ok")}
          </button>
        )}
      </div>
    </fieldset>
  );
}
