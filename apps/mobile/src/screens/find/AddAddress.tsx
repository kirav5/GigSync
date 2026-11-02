import type { Ports } from "@gigsync/core";
import type { SavedAddress, Session } from "@gigsync/protocol";
import { tapNeed } from "../../find/needStore.js";
import { useI18n } from "../../i18n.js";
import { AddressForm } from "../address/AddressForm.js";

/**
 * "Add an address" from Find's "where" question (ADR 0045): the form, and once saved, the new address answers the
 * question as if its chip had been tapped.
 */
export function AddAddress({
  chat,
  session,
  ports,
  added,
  onDone,
}: {
  chat: string;
  session: Session;
  ports: Ports;
  added: (chat: string, address: SavedAddress) => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  return (
    <AddressForm
      session={session}
      storage={ports.storage}
      onSaved={(a) => {
        onDone();
        added(chat, a);
        tapNeed(chat, a.id, t("addr.chip", { label: t(`addr.label.${a.label}`), area: a.area }));
      }}
      onCancel={onDone}
    />
  );
}
