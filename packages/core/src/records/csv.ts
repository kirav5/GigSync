import { type ExportedJob, PAISE_PER_RUPEE } from "@gigsync/protocol";
import { byAgreed, jobDay, methodsOf, paidFor } from "./export.js";

/**
 * "My work record" as a CSV file the worker can keep or hand to anyone: one row per job, oldest first, with column
 * names and words in the worker's language (the app passes them in). Amounts in rupees.
 */

/** The columns, in order. */
export const CSV_COLUMNS = ["date", "work", "price", "paid", "method", "status", "attested", "stars"] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

/** What a value in a cell is, for the app to put in the worker's words. */
export const CsvWord = { trade: "trade", status: "status", method: "method" } as const;
export type CsvWord = (typeof CsvWord)[keyof typeof CsvWord];

export interface CsvWords {
  /** Each column's heading. */
  heading: Record<CsvColumn, string>;
  word(kind: CsvWord, value: string): string;
  /** Who confirmed the job: both sides, or only the worker (the household never sent its side). */
  attested(both: boolean): string;
}

const LINE = "\r\n";
const LIST = "; ";
const NEEDS_QUOTES = /[",;\r\n]/;
const QUOTE = /"/g;

/** One cell, quoted when it holds a separator, a quote or a line break. */
const cell = (value: string): string => (NEEDS_QUOTES.test(value) ? `"${value.replace(QUOTE, '""')}"` : value);
const rupees = (paise: number): string => (paise / PAISE_PER_RUPEE).toFixed(2);

function row(job: ExportedJob, words: CsvWords): string[] {
  return [
    jobDay(job),
    words.word(CsvWord.trade, job.work.trade),
    rupees(job.price_paise),
    rupees(paidFor(job)),
    methodsOf(job)
      .map((m) => words.word(CsvWord.method, m))
      .join(LIST),
    words.word(CsvWord.status, job.status),
    words.attested(job.attested),
    job.stars === undefined ? "" : String(job.stars),
  ];
}

export function recordCsv(jobs: readonly ExportedJob[], words: CsvWords): string {
  const sorted = [...jobs].sort(byAgreed);
  const lines = [CSV_COLUMNS.map((c) => words.heading[c]), ...sorted.map((j) => row(j, words))];
  return lines.map((cells) => cells.map(cell).join(",")).join(LINE) + LINE;
}
