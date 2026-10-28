import { type Ports, t } from "@gigsync/core";
import { DEFAULT_LANG, Lang } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { type Account, AccountRole, sendCode, signIn } from "../adapters/account.js";
import { C } from "../ui/cls.js";

/** The form's field names. */
const F = { name: "name", phone: "phone", address: "address", code: "code" } as const;

const ROLES: readonly { role: AccountRole; label: string }[] = [
  { role: AccountRole.consumer, label: "I need work done" },
  { role: AccountRole.worker, label: "I do the work" },
];

/** Phone and one-time code. The code goes to the server; this phone's private keys never do. */
export function SignIn({ ports, onSignedIn }: { ports: Ports; onSignedIn: (a: Account) => void }) {
  const [role, setRole] = useState<AccountRole>(AccountRole.consumer);
  const [lang, setLang] = useState<Lang>(DEFAULT_LANG);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const phone = String(v.get(F.phone) ?? "").trim();
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
      onSignedIn(await signIn(ports, { phone, code: String(v.get(F.code) ?? "").trim(), role, contact, lang }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>Sign in</span>
        <h1 className={C.headline}>
          Your agent, your phone. <span className={C.soft}>Your number stays yours.</span>
        </h1>
      </div>
      <form className={C.card} onSubmit={(e) => void submit(e)} aria-label="Sign in">
        <fieldset className={C.row} aria-label="Role">
          {ROLES.map((r) => (
            <label key={r.role} className={role === r.role ? C.chipOn : C.chip}>
              <input type="radio" name="role" checked={role === r.role} onChange={() => setRole(r.role)} />
              {r.label}
            </label>
          ))}
        </fieldset>
        <fieldset className={C.row} aria-label="Language">
          {Lang.options.map((l) => (
            <label key={l} lang={l} className={lang === l ? C.chipOn : C.chip}>
              <input type="radio" name="lang" checked={lang === l} onChange={() => setLang(l)} />
              {t(l, `lang.${l}`)}
            </label>
          ))}
        </fieldset>
        <label className={C.fieldLabel}>
          <span className={C.muted}>Your name</span>
          <input className={C.field} name={F.name} required autoComplete={F.name} />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>Mobile number</span>
          <input className={C.field} name={F.phone} required placeholder="+919800000000" inputMode="tel" />
        </label>
        {role === AccountRole.consumer && (
          <label className={C.fieldLabel}>
            <span className={C.muted}>Address, shared only with the worker you sign a job with</span>
            <input className={C.field} name={F.address} autoComplete="street-address" />
          </label>
        )}
        {sent && (
          <label className={C.fieldLabel}>
            <span className={C.muted}>Code from SMS{import.meta.env.DEV ? " (dev: 000000)" : ""}</span>
            <input className={C.field} name={F.code} required inputMode="numeric" autoComplete="one-time-code" />
          </label>
        )}
        {error && <p className={C.error}>{error}</p>}
        <div>
          <button type={C.submit} className={C.accent} disabled={busy}>
            {sent ? "Sign in" : "Send code"}
          </button>
        </div>
      </form>
    </>
  );
}
