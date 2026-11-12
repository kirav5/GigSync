import { UPI_MAX_PAISE } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const RUPEE = 100;
const RUPEE_SIGN = "₹";
const NOT_DIGITS = /\D/g;

/** One offer of the owner's own, in whole rupees, the ₹ before the figure as on a price. */
export function OwnOffer({ onSend }: { onSend: (paise: number, sent: () => void) => void }) {
  const { t } = useI18n();
  const [rupees, setRupees] = useState("");
  const amount = Number.parseInt(rupees, 10);
  return (
    <div className="offer-row">
      <span className="money-field">
        <span aria-hidden="true">{RUPEE_SIGN}</span>
        <input
          className={C.field}
          inputMode="numeric"
          aria-label={t("decide.your_offer")}
          placeholder={t("decide.your_offer")}
          value={rupees}
          onChange={(e) => setRupees(e.target.value.replace(NOT_DIGITS, ""))}
        />
      </span>
      <button
        type={C.button}
        className={C.secondary}
        disabled={!(amount > 0 && amount * RUPEE <= UPI_MAX_PAISE)}
        onClick={() => onSend(amount * RUPEE, () => setRupees(""))}
      >
        {t("decide.send_offer")}
      </button>
    </div>
  );
}
