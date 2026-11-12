import { localDay, mondayOf, OPEN_PAYMENT, passbook } from "@gigsync/core";
import { PaymentStatus, type UserId } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import type { GigView } from "../../useGig.js";
import { namesText, themOf } from "../activity/jobWords.js";
import { phoneOffset } from "../record/useRecords.js";

interface Props {
  view: GigView;
  me: UserId;
  now: Date;
  /** Opens the Money tab: every payment, the month, and what is not asked for yet. */
  onMoney: () => void;
}

/**
 * Home's earth card, money first (design W7): what came in this week and from how many payments, and what is still
 * waiting and from whom. The same passbook as the Money tab (only jobs both signed); a tap opens that tab.
 */
export function MoneyCard({ view, me, now, onMoney }: Props) {
  const { lang, t, plural } = useI18n();
  const offset = phoneOffset(now);
  const { rows, totals } = passbook(view.jobs, view.payments, me, now, offset);
  // The passbook's week, Monday to Sunday on this phone: the payments behind its total, counted.
  const week = mondayOf(localDay(now, offset));
  const count = rows.filter(
    ({ payment: p }) =>
      p.status === PaymentStatus.enum.confirmed &&
      p.confirmed_at !== undefined &&
      mondayOf(localDay(new Date(p.confirmed_at), offset)) === week,
  ).length;
  const waiting = rows.filter((r) => OPEN_PAYMENT.has(r.payment.status));
  const from = [...new Set(waiting.map((r) => themOf(r.job, view.names, t)))];
  return (
    <button type={C.button} className="card card-earth home-money" onClick={onMoney}>
      <span className="money-big">{money(totals.week)}</span>
      <span className="fine">
        {t("passbook.week")}
        {count > 0 && ` · ${plural("jobs.payments", count)}`}
      </span>
      {totals.waiting > 0 && (
        <span className="fine">
          {t("jobs.waiting_from", { price: money(totals.waiting), names: namesText(lang, from) })}
        </span>
      )}
    </button>
  );
}
