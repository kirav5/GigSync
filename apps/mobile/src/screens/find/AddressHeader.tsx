import type { Storage } from "@gigsync/core";
import { openAddressDesk } from "../../find/addressDesk.js";
import { useAddressBook } from "../../find/useAddressBook.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import "./find.css";

/**
 * The address Find is using, at the top of the screen (ADR 0050 §6): a pin, its label with the door and area, and a
 * chevron; or "Add your address". Tapping it opens the address turn in the chat, where it is changed by talking or
 * tapping.
 */
export function AddressHeader({ storage }: { storage: Storage }) {
  const { t } = useI18n();
  const { inUse } = useAddressBook(storage);
  const label = inUse ? t(`addr.label.${inUse.label}`) : undefined;
  const line = inUse && (inUse.house ? `${inUse.house}, ${inUse.area}` : inUse.area);
  return (
    <button
      type={C.button}
      className="address-row"
      aria-label={inUse ? t("addr.header", { label: label ?? "", area: inUse.area }) : t("addr.header_none")}
      onClick={openAddressDesk}
    >
      <Icon name="pin" size={16} />
      <span className="address-row-text">
        <span className="address-row-label">{label ?? t("addr.header_none")}</span>
        {line && <span className="address-row-line">{line}</span>}
      </span>
      <Icon name="chev" size={14} />
    </button>
  );
}
