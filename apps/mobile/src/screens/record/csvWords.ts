import { type CsvColumn, CsvWord, type CsvWords, type MessageKey } from "@gigsync/core";
import { JobRecordStatus, PaymentMethod, Trade } from "@gigsync/protocol";

/** Each column's heading, by key. */
const HEADING: Readonly<Record<CsvColumn, MessageKey>> = {
  date: "records.col_date",
  work: "records.col_work",
  price: "records.col_price",
  paid: "records.col_paid",
  method: "records.col_method",
  status: "records.col_status",
  attested: "records.col_attested",
  stars: "records.col_stars",
};

export const STATUS_WORD: Readonly<Record<JobRecordStatus, MessageKey>> = {
  agreed: "records.status_agreed",
  done: "records.status_done",
  cancelled: "records.status_cancelled",
};

/** The work record file's words in the owner's language; a value the app has no word for stays as it is. */
export function csvWords(t: (key: MessageKey) => string): CsvWords {
  const heading = Object.fromEntries(Object.entries(HEADING).map(([c, key]) => [c, t(key)])) as Record<
    CsvColumn,
    string
  >;
  return {
    heading,
    word(kind, value) {
      if (kind === CsvWord.trade) {
        const trade = Trade.safeParse(value).data;
        return trade ? t(`trade.${trade}`) : value;
      }
      if (kind === CsvWord.status) {
        const status = JobRecordStatus.safeParse(value).data;
        return status ? t(STATUS_WORD[status]) : value;
      }
      const method = PaymentMethod.safeParse(value).data;
      return method ? t(`method.${method}`) : value;
    },
    attested: (both) => t(both ? "records.by_both" : "records.by_you"),
  };
}
