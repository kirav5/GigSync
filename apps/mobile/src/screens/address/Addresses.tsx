import { addressLine, listAddresses, type Ports, removeAddress } from "@gigsync/core";
import type { SavedAddress, Session } from "@gigsync/protocol";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { AddressForm } from "./AddressForm.js";

/**
 * Saved addresses (ADR 0045), from Settings: each with its label and its whole line, a way to remove it, and a way to
 * add one. Kept on this phone only; Find offers them at its "where" question.
 */
export function Addresses({ ports, session }: { ports: Ports; session: Session }) {
  const { t } = useI18n();
  const [saved, setSaved] = useState<SavedAddress[]>();
  const [adding, setAdding] = useState(false);
  const reload = useCallback(() => void listAddresses(ports.storage).then(setSaved), [ports]);
  useEffect(reload, [reload]);

  if (adding)
    return (
      <AddressForm
        session={session}
        storage={ports.storage}
        onSaved={() => {
          setAdding(false);
          reload();
        }}
        onCancel={() => setAdding(false)}
      />
    );
  return (
    <section className={C.stack} aria-label={t("addr.title")}>
      <span className={C.label}>{t("addr.title")}</span>
      <p className={C.faint}>{t("addr.private")}</p>
      {saved?.length === 0 && <p className={C.empty}>{t("addr.none")}</p>}
      {saved?.map((a) => (
        <div key={a.id} className={C.card}>
          <strong>{t(`addr.label.${a.label}`)}</strong>
          <span className={C.muted}>{addressLine(a)}</span>
          <button
            type={C.button}
            className={C.quiet}
            onClick={() => void removeAddress(ports.storage, a.id).then(reload)}
          >
            {t("addr.remove")}
          </button>
        </div>
      ))}
      <button type={C.button} className={C.secondary} onClick={() => setAdding(true)}>
        {t("addr.add")}
      </button>
    </section>
  );
}
