import type { Ports } from "@gigsync/core";
import type { SavedAddress, Session } from "@gigsync/protocol";
import { tapNeed } from "../../find/needStore.js";
import { useI18n } from "../../i18n.js";
import { AddressForm } from "../address/AddressForm.js";

/** How the form opens from the "where" question: to be typed or pinned, or at "Use my current location". */
export const Adding = { typed: "typed", locate: "locate" } as const;
export type Adding = (typeof Adding)[keyof typeof Adding];

/**
 * "Add an address" or "Use my current location" from Find's "where" question (ADR 0045): the form, and once saved,
 * the new address answers the question as if its card had been tapped.
 */
export function AddAddress({
  chat,
  session,
  ports,
  added,
  adding,
  onDone,
}: {
  chat: string;
  session: Session;
  ports: Ports;
  added: (chat: string, address: SavedAddress) => void;
  adding: Adding;
  onDone: () => void;
}) {
  const { t } = useI18n();
  return (
    <AddressForm
      key={adding}
      session={session}
      storage={ports.storage}
      locateFirst={adding === Adding.locate}
      onSaved={(a) => {
        onDone();
        added(chat, a);
        tapNeed(chat, a.id, t("addr.chip", { label: t(`addr.label.${a.label}`), area: a.area }));
      }}
      onCancel={onDone}
    />
  );
}
