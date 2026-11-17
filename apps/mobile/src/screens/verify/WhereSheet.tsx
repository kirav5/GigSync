import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Sheet } from "../../ui/Sheet.js";

/**
 * "Where do I get these?": the three things the check takes and where each comes from, one line each: the card's QR,
 * the e-Aadhaar PDF from myAadhaar, the Offline e-KYC ZIP from myAadhaar or the mAadhaar app.
 */
export function WhereSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet title={t("idcheck.where_title")} icon="shield" onClose={onClose}>
      <ul className="verify-where">
        <li>{t("idcheck.where_card")}</li>
        <li>{t("idcheck.where_pdf")}</li>
        <li>{t("idcheck.where_ekyc")}</li>
      </ul>
      <button type={C.button} className={`${C.wide} btn-big`} onClick={onClose}>
        {t("idcheck.where_ok")}
      </button>
    </Sheet>
  );
}
