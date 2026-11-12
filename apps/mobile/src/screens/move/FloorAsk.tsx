import { FloorError, log, type MessageKey, type Ports, parseAmount, withFloor } from "@gigsync/core";
import { type FormEvent, useId, useState } from "react";
import { type Account, saveAccount } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";

const FLOOR_FIELD = "floor";

/**
 * On Home, while a worker's card came back from the board without their lowest price (ADR 0037 §4): the one thing
 * asked for. Until it is given the card stays listed and the agent shows each request before quoting.
 */
export function FloorAsk({
  ports,
  account,
  onSaved,
}: {
  ports: Ports;
  account: Account;
  onSaved: (a: Account) => void;
}) {
  const { t } = useI18n();
  const heading = useId();
  const [problem, setProblem] = useState<MessageKey>();
  const [busy, setBusy] = useState(false);
  const rules = account.worker;
  if (!rules?.floor_missing) return null;
  const usual = money(rules.rate.opening_paise);

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const typed = parseAmount(String(new FormData(e.currentTarget).get(FLOOR_FIELD) ?? ""));
    setBusy(true);
    try {
      const next: Account = { ...account, worker: withFloor(rules, typed ?? 0) };
      await saveAccount(ports, next);
      onSaved(next);
    } catch (err) {
      if (!(err instanceof FloorError)) log.warn("lowest price not saved", { error: String(err) });
      setProblem("phone.floor_bad");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={C.card} aria-labelledby={heading} onSubmit={(e) => void save(e)}>
      <span id={heading} className={C.label}>
        {t("phone.floor_title")}
      </span>
      <span>{t("phone.floor_about")}</span>
      <label className={C.fieldLabel}>
        <span className={C.muted}>{t("phone.floor_label")}</span>
        <input className={C.field} name={FLOOR_FIELD} inputMode="numeric" required />
      </label>
      {problem && (
        <p className={C.error} role="status">
          {t(problem, { price: usual })}
        </p>
      )}
      <div className={C.actions}>
        <button type={C.submit} className={C.accent} disabled={busy} aria-busy={busy}>
          {t("settings.save")}
        </button>
      </div>
    </form>
  );
}
