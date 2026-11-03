import type { Storage } from "@gigsync/core";
import { openAddressDesk } from "../../find/addressDesk.js";
import { useAddressBook } from "../../find/useAddressBook.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/**
 * The address Find is using, at the top of the screen (ADR 0050 §6): its label and area, or "Add your address".
 * Tapping it opens the address turn in the chat, where it is changed by talking or tapping.
 */
export function AddressHeader({ storage }: { storage: Storage }) {
  const { t } = useI18n();
  const { inUse } = useAddressBook(storage);
  const label = inUse ? t(`addr.label.${inUse.label}`) : undefined;
  return (
    <button
      type={C.button}
      className="address-head"
      aria-label={inUse ? t("addr.header", { label: label ?? "", area: inUse.area }) : t("addr.header_none")}
      onClick={openAddressDesk}
    >
      <span className="address-head-label">{label ?? t("addr.header_none")} ▾</span>
      {inUse && <span className="address-head-line">{inUse.house ? `${inUse.house}, ${inUse.area}` : inUse.area}</span>}
    </button>
  );
}
