import { useEffect, useRef } from "react";
import { AccountRole } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { InstallCard } from "../../ui/InstallCard.js";
import { Field, FORM_ID } from "./form.js";
import { StartBar } from "./StartBar.js";

/** Stands where the link goes in the sign-in line, so each language puts it where its grammar wants it. */
const LINK_SLOT = "⁣";

/**
 * The number, under the promise that matters most here: it reaches the other side only once both have signed a job,
 * and only for that job (protocol job.ts ContactCard; ADR 0039 §3). The name is asked here too: the board, the QR card
 * and the payee need it, and nothing asks it later. On iPhone the install card comes now, before sign-in, because the
 * home-screen app keeps its own data.
 */
export function NumberStep({
  role,
  name,
  phone,
  onName,
  onPhone,
  onBack,
}: {
  role: AccountRole;
  name: string;
  phone: string;
  onName: (name: string) => void;
  onPhone: (phone: string) => void;
  onBack: () => void;
}) {
  const { lang, t } = useI18n();
  const nameField = useRef<HTMLInputElement>(null);
  const phoneField = useRef<HTMLInputElement>(null);
  // Arriving from the role, the keyboard comes up on the name; back from the code to change it, on the number.
  useEffect(() => {
    (nameField.current?.value ? phoneField : nameField).current?.focus();
  }, []);

  return (
    <>
      <StartBar title={t("start.number_title")} onBack={onBack} />
      <h1 className="hero-title">{t("signin.soft")}</h1>
      <p className={C.muted}>
        {t(role === AccountRole.worker ? "start.number_why_worker" : "start.number_why_household")}
      </p>
      <label className={C.fieldLabel}>
        <span className={C.muted}>{t("signin.name")}</span>
        <input
          ref={nameField}
          className={C.field}
          name={Field.name}
          required
          autoComplete={Field.name}
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      <label className={C.fieldLabel}>
        <span className={C.muted}>{t("signin.phone")}</span>
        <span className="start-phone">
          <Icon name="call" size={18} />
          <input
            ref={phoneField}
            className={C.field}
            name={Field.phone}
            required
            placeholder="98000 00000"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
          />
        </span>
      </label>
      <InstallCard lang={lang} />
    </>
  );
}

/** The number step's dock: Send code, and the agreement line under it. */
export function NumberActions({ busy, onTerms }: { busy: boolean; onTerms: () => void }) {
  const { t } = useI18n();
  return (
    <>
      <button type={C.submit} form={FORM_ID} className={`${C.wide} btn-big`} disabled={busy} aria-busy={busy}>
        {t("signin.send_code")}
      </button>
      <AgreeLine onTerms={onTerms} />
    </>
  );
}

/** "By continuing, you agree to GigSync's Terms and Privacy Notice", the documents' name a link (ADR 0039 §4). */
function AgreeLine({ onTerms }: { onTerms: () => void }) {
  const { t } = useI18n();
  const [before, after = ""] = t("records.signin_line", { link: LINK_SLOT }).split(LINK_SLOT);
  return (
    <p className="fine start-agree">
      {before}
      <button type={C.button} className={C.linkBtn} onClick={onTerms}>
        {t("records.signin_link")}
      </button>
      {after}
    </p>
  );
}
