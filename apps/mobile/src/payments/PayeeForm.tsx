import { loadPayee, log, type MessageKey, PayeeError, PayeeProblem, type Ports, savePayee } from "@gigsync/core";
import { PAYEE_NAME_MAX } from "@gigsync/protocol";
import { type FormEvent, useEffect, useId, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import "./money.css";

/** UPI IDs are typed as-is: no capitals or corrections added by the phone keyboard. */
const NO_CAPS = "none";

/** Each problem with the details, as the line that says it. */
const PROBLEM: Readonly<Record<PayeeProblem, MessageKey>> = {
  [PayeeProblem.vpa]: "settings.err_vpa",
  [PayeeProblem.name]: "settings.err_name",
  [PayeeProblem.name_long]: "settings.err_name_long",
};

/**
 * About me's "Get paid to": the one place the UPI ID and the name payers see are entered. Payment requests and the QR
 * read them from there when they are needed, so a change here applies to the next one at once. Once saved it is one
 * line with Change, so the form only takes room while it is being filled in.
 */
export function PayeeForm({ ports, defaultName }: { ports: Ports; defaultName: string }) {
  const { t } = useI18n();
  const heading = useId();
  const [vpa, setVpa] = useState("");
  const [name, setName] = useState(defaultName);
  const [edited, setEdited] = useState(false);
  const [status, setStatus] = useState<{ saved: boolean; text: string }>();
  /** What is saved, shown as one line; undefined until loaded, null when nothing is saved yet. */
  const [saved, setSaved] = useState<{ vpa: string; name: string } | null>();
  const [editing, setEditing] = useState(false);

  // Fill in what is saved, unless the owner has started typing first. Nothing saved keeps their own name.
  useEffect(() => {
    let live = true;
    loadPayee(ports.storage)
      .then((found) => {
        if (!live) return;
        setSaved(found ? { vpa: found.vpa, name: found.name } : null);
        if (edited || !found) return;
        setVpa(found.vpa);
        setName(found.name);
      })
      .catch((err: unknown) => log.warn("loading payee failed", { error: err instanceof Error ? err.message : "" }));
    return () => {
      live = false;
    };
  }, [ports, edited]);

  function edit(set: (v: string) => void, value: string) {
    set(value);
    setEdited(true);
    setStatus(undefined);
  }

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await savePayee(ports.storage, { vpa, name });
      // Shown as the store keeps it (trimmed, as checked), not as typed.
      const stored = await loadPayee(ports.storage);
      setSaved(stored ? { vpa: stored.vpa, name: stored.name } : null);
      setEditing(false);
      setStatus({ saved: true, text: t("settings.saved") });
    } catch (err) {
      if (err instanceof PayeeError)
        return setStatus({ saved: false, text: t(PROBLEM[err.problem], { max: PAYEE_NAME_MAX }) });
      log.warn("saving payee failed", { error: err instanceof Error ? err.message : String(err) });
      setStatus({ saved: false, text: t("error.generic") });
    }
  }

  if (saved && !editing)
    return (
      <section className={`${C.card} payee-form`} aria-labelledby={heading}>
        <h2 id={heading} className={C.label}>
          {t("settings.paid_to")}
        </h2>
        <div className={`${C.row} payee-line`}>
          <span className="payee-id">
            <span className="payee-vpa">{saved.vpa}</span>
            <span className={C.muted}>{saved.name}</span>
          </span>
          <button type={C.button} className={`${C.secondary} end`} onClick={() => setEditing(true)}>
            {t("settings.change")}
          </button>
        </div>
        {status?.saved && (
          <p role="status" className={`${C.label} saved`}>
            {status.text}
          </p>
        )}
      </section>
    );

  return (
    <form className={`${C.card} payee-form`} aria-labelledby={heading} onSubmit={(e) => void onSave(e)} noValidate>
      <h2 id={heading} className={C.label}>
        {t("settings.paid_to")}
      </h2>
      <label className={C.fieldLabel}>
        <span className={C.muted}>{t("settings.vpa")}</span>
        <input
          className={C.field}
          name="vpa"
          inputMode="email"
          placeholder="name@bank"
          value={vpa}
          onChange={(e) => edit(setVpa, e.target.value)}
          autoComplete={C.off}
          autoCapitalize={NO_CAPS}
          autoCorrect={C.off}
          spellCheck={false}
        />
      </label>
      <label className={C.fieldLabel}>
        <span className={C.muted}>{t("settings.name")}</span>
        <input
          className={C.field}
          name="name"
          autoComplete="name"
          maxLength={PAYEE_NAME_MAX}
          value={name}
          onChange={(e) => edit(setName, e.target.value)}
        />
      </label>
      <p role="status" className={status?.saved ? `${C.label} saved` : C.error}>
        {status?.text}
      </p>
      <div>
        <button type={C.submit} className={C.btn}>
          {t("settings.save")}
        </button>
      </div>
      <span className={C.faint}>{t("settings.vpa_about")}</span>
    </form>
  );
}
