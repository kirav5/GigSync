import { ContactCard } from "@gigsync/protocol";
import { useEffect, useRef } from "react";
import { AccountRole } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Field, FORM_ID } from "./form.js";
import { Art, StartArt } from "./StartArt.js";
import { START_STEPS, StartBar } from "./StartBar.js";

/**
 * The name, asked once, after the number is verified and only when this phone has none for it: a returning number
 * goes straight in with the name it had, so signing in again can never change it. Back goes to find work or find
 * help when that was just asked (`onBack`); never to the code, which is already used. The name is changed later on
 * the card or in Me.
 */
export function NameStep({
  role,
  name,
  onName,
  onBack,
}: {
  role: AccountRole;
  name: string;
  onName: (name: string) => void;
  onBack?: () => void;
}) {
  const { t } = useI18n();
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  return (
    <>
      <StartBar step={START_STEPS} {...(onBack ? { onBack } : {})} />
      <StartArt art={Art.greet} small />
      <h1 className="start-title">{t("start.name_title")}</h1>
      <label className={C.fieldLabel}>
        <span className="start-label">{t("signin.name")}</span>
        <input
          ref={field}
          className={C.field}
          name={Field.name}
          required
          maxLength={NAME_MAX}
          autoComplete="given-name"
          value={name}
          onChange={(e) => onName(e.target.value)}
        />
      </label>
      <p className="start-note">
        {t(role === AccountRole.worker ? "start.name_why_worker" : "start.name_why_household")}
      </p>
    </>
  );
}

/** The longest name a contact card takes. */
const NAME_MAX = ContactCard.shape.name.maxLength ?? undefined;

/** The name step's dock: Continue, which saves the name and signs in. */
export function NameActions({ busy }: { busy: boolean }) {
  const { t } = useI18n();
  return (
    <button type={C.submit} form={FORM_ID} className={`${C.wide} btn-big`} disabled={busy} aria-busy={busy}>
      {t("start.continue")}
    </button>
  );
}
