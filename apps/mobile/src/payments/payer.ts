import { type JobRecord, UpiParam } from "@gigsync/core";
import type { I18n } from "../i18n.js";
import type { GigView } from "../useGig.js";

/** The customer as the worker knows them: their contact card's name, the board's, or "the customer". */
export function payerName(job: JobRecord, view: GigView, t: I18n["t"]): string {
  return job.contact?.name || view.names[job.engagement.counterpart] || t("job.customer");
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** "11:05 am" today, "31 Oct 11:05 am" on another day: when money was asked for, said to be paid, or the work done. */
export function moneyWhen({ time, date }: Pick<I18n, "time" | "date">, at: string): string {
  const when = new Date(at);
  return sameDay(when, new Date()) ? time(when) : `${date(when)} ${time(when)}`;
}

/** Who a UPI link pays, read back from the link itself, so the words beside it can never differ from what is paid. */
export function payeeIn(link: string): { vpa: string; name: string } {
  const query = new URLSearchParams(link.slice(link.indexOf("?") + 1));
  return { vpa: query.get(UpiParam.payee) ?? "", name: query.get(UpiParam.name) ?? "" };
}
