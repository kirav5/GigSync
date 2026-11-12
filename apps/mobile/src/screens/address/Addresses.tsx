import { addressLine, listAddresses, type Ports, removeAddress } from "@gigsync/core";
import type { SavedAddress, Session } from "@gigsync/protocol";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";
import { Badge, BadgeTone } from "../../ui/Badge.js";
import { C } from "../../ui/cls.js";
import { ListCard, ListRow } from "../../ui/ListRow.js";
import { LABEL_ICON } from "./AddressFields.js";
import { AddressForm } from "./AddressForm.js";
import "./address.css";

/**
 * Saved addresses (ADR 0045), from Me: each with its label, its whole line, a mark when its pin is on the door, and a
 * way to remove it; and a way to add one. Kept on this phone only; Find offers them at its "where" question.
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
    <section className={`${C.stack} address-list`} aria-label={t("addr.title")}>
      <p className={C.faint}>{t("addr.private")}</p>
      {saved?.length === 0 && <p className={C.empty}>{t("addr.none")}</p>}
      {saved && saved.length > 0 && (
        <ListCard>
          {saved.map((a) => (
            <ListRow
              key={a.id}
              icon={LABEL_ICON[a.label]}
              title={t(`addr.label.${a.label}`)}
              sub={
                <>
                  {addressLine(a)}
                  {a.pinned && (
                    <Badge icon="pin" tone={BadgeTone.green}>
                      {t("me.door_pin")}
                    </Badge>
                  )}
                </>
              }
              end={
                <button
                  type={C.button}
                  className={C.quiet}
                  onClick={() => void removeAddress(ports.storage, a.id).then(reload)}
                >
                  {t("addr.remove")}
                </button>
              }
            />
          ))}
        </ListCard>
      )}
      <button type={C.button} className={C.secondary} onClick={() => setAdding(true)}>
        {t("addr.add")}
      </button>
    </section>
  );
}
