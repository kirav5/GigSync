import { log, type MessageKey, type Ports } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import { type Account, saveSite } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const SITE = "site";

/**
 * Where a worker's own work is, kept as the address on their contact card, which a helper they hire receives only
 * once both sign. `ask` is Find's first step when hiring, under its title (it must be filled in); without it,
 * Profile's field, which may be cleared.
 */
export function SiteForm({
  ports,
  account,
  ask = false,
  onSaved,
}: {
  ports: Ports;
  account: Account;
  ask?: boolean;
  onSaved: (a: Account) => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<{ saved: boolean; key: MessageKey }>();
  const label = t(ask ? "hire.site" : "hire.site_profile");

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = String(new FormData(e.currentTarget).get(SITE) ?? "").trim();
    if (ask && !address) return;
    try {
      onSaved(await saveSite(ports, account, address));
      setStatus({ saved: true, key: "settings.saved" });
    } catch (err) {
      log.warn("work site not saved", { error: err instanceof Error ? err.message : String(err) });
      setStatus({ saved: false, key: "error.generic" });
    }
  }

  return (
    <>
      {ask && <h1 className={C.headline}>{t("hire.title")}</h1>}
      <form className={C.card} aria-label={label} onSubmit={(e) => void save(e)}>
        <span className={C.label}>{label}</span>
        <input
          className={C.field}
          name={SITE}
          aria-label={label}
          defaultValue={account.contact.address ?? ""}
          required={ask}
          autoComplete="street-address"
        />
        <span className={C.faint}>{t("hire.site_help")}</span>
        <div className={C.actions}>
          <button type={C.submit} className={ask ? C.accent : C.secondary}>
            {t(ask ? "hire.site_save" : "settings.save")}
          </button>
        </div>
        {status && (
          <p role="status" className={status.saved ? C.muted : C.error}>
            {t(status.key)}
          </p>
        )}
      </form>
    </>
  );
}
