import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import "./qr.css";

/** Profile's one row for the owner's QR: lean, as Profile is; the QR itself is a tap away. */
export function QrRow({ onOpen }: { onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <button type={C.button} className="qr-row" onClick={onOpen}>
      <span className="who">
        <strong>{t("qr.mine")}</strong>
        <span className={C.muted}>{t("qr.row_about")}</span>
      </span>
    </button>
  );
}
