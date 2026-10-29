import { log, type MessageKey, type Ports } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import { type Account, AccountRole, sendCode, signIn } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { errorKey } from "../ui/errorKey.js";
import { phoneE164 } from "../ui/phone.js";

/** The form's field names. */
const F = { name: "name", phone: "phone", address: "address", code: "code" } as const;
/** Ties the dock's button, outside the form, to it. */
const FORM_ID = "signin";
/** The code the development API accepts, shown only in dev builds. */
const DEV_CODE = "000000";

const ROLES: readonly { role: AccountRole; label: MessageKey }[] = [
  { role: AccountRole.consumer, label: "signin.consumer" },
  { role: AccountRole.worker, label: "signin.worker" },
];

/** Phone and one-time code. The code goes to the server; this phone's private keys never do. */
export function SignIn({
  ports,
  onSignedIn,
  onLanguage,
}: {
  ports: Ports;
  onSignedIn: (a: Account) => void;
  /** Back to the first screen to pick another language. */
  onLanguage: () => void;
}) {
  const { lang, t } = useI18n();
  const [role, setRole] = useState<AccountRole>(AccountRole.consumer);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const phone = phoneE164(String(v.get(F.phone) ?? ""));
    if (!phone) return setError(t("signin.err_phone"));
    setBusy(true);
    setError(undefined);
    try {
      if (!sent) {
        await sendCode(phone);
        setSent(true);
        return;
      }
      const address = String(v.get(F.address) ?? "").trim();
      const contact = { name: String(v.get(F.name) ?? "").trim(), phone, ...(address ? { address } : {}) };
      onSignedIn(await signIn(ports, { phone, code: String(v.get(F.code) ?? "").trim(), role, contact }));
    } catch (err) {
      log.warn("sign-in failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("signin.label")}</span>
        <h1 className={C.headline}>
          {t("signin.headline")} <span className={C.soft}>{t("signin.soft")}</span>
        </h1>
        <span className={C.faint}>
          {t("signin.language", { lang: t(`lang.${lang}`) })} ·{" "}
          <button type={C.button} className={C.linkBtn} onClick={onLanguage}>
            {t("signin.change")}
          </button>
        </span>
      </div>
      <form id={FORM_ID} className={C.card} onSubmit={(e) => void submit(e)} aria-label={t("signin.label")}>
        <fieldset className={C.actions} aria-label={t("a11y.role")}>
          {ROLES.map((r) => (
            <label key={r.role} className={role === r.role ? C.chipOn : C.chip}>
              <input type="radio" name="role" checked={role === r.role} onChange={() => setRole(r.role)} />
              {t(r.label)}
            </label>
          ))}
        </fieldset>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("signin.name")}</span>
          <input className={C.field} name={F.name} required autoComplete={F.name} />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("signin.phone")}</span>
          <input className={C.field} name={F.phone} required placeholder="98000 00000" type="tel" autoComplete="tel" />
        </label>
        {role === AccountRole.consumer && (
          <label className={C.fieldLabel}>
            <span className={C.muted}>{t("signin.address")}</span>
            <input className={C.field} name={F.address} autoComplete="street-address" />
          </label>
        )}
        {sent && (
          <label className={C.fieldLabel}>
            <span className={C.muted}>
              {import.meta.env.DEV ? t("signin.code_dev", { code: DEV_CODE }) : t("signin.code")}
            </span>
            <input className={C.field} name={F.code} required inputMode="numeric" autoComplete="one-time-code" />
          </label>
        )}
      </form>
      <Dock>
        <p className={C.dockError} role="status" aria-live="polite">
          {error}
        </p>
        <button type={C.submit} form={FORM_ID} className={C.wide} disabled={busy}>
          {t(sent ? "signin.submit" : "signin.send_code")}
        </button>
      </Dock>
    </>
  );
}
