import { type CsvColumn, CsvWord, type CsvWords, type MessageKey } from "@gigsync/core";
import { JobRecordStatus, PaymentMethod, type Role, Trade } from "@gigsync/protocol";

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

const STATUS_WORD: Readonly<Record<JobRecordStatus, MessageKey>> = {
  agreed: "records.status_agreed",
  done: "records.status_done",
  cancelled: "records.status_cancelled",
};

/**
 * What changes with the owner's side of the jobs: the money column (received by a worker, paid by a household), and
 * who alone stands behind a one-sided job, which only the worker's side ever reaches GigSync for.
 */
const SIDE: Readonly<Record<Role, { paid: MessageKey; alone: MessageKey }>> = {
  provider: { paid: "records.col_paid", alone: "records.by_you" },
  requester: { paid: "ledger.col_paid", alone: "ledger.by_worker" },
};

/** The record file's words in the owner's language, for their side; a value the app has no word for stays as it is. */
export function csvWords(t: (key: MessageKey) => string, side: Role): CsvWords {
  const words = SIDE[side];
  const heading = Object.fromEntries(
    Object.entries({ ...HEADING, paid: words.paid }).map(([c, key]) => [c, t(key)]),
  ) as Record<CsvColumn, string>;
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
    attested: (both) => t(both ? "records.by_both" : words.alone),
  };
}
