/** The Money and Pay tabs and the worker's record. */
export const ledger = {
  // The worker's Money tab: this week, this month, and who the money still waits on
  "ledger.week_count.one": "{count} payment",
  "ledger.week_count.other": "{count} payments",
  "ledger.this_month": "This month",
  "ledger.waiting_from": "Waiting from {name}",
  "ledger.waiting_many": "Waiting from {count} households",
  "ledger.upi_line": "Your UPI: {vpa}",
  "ledger.upi_change": "Change in About me",
  "ledger.upi_none": "No UPI ID saved yet.",
  "ledger.upi_add": "Add it in About me",
  // The household's Pay tab and the receipts it downloads
  "ledger.not_confirmed": "Not confirmed yet",
  "ledger.download_receipts": "Download receipts",
  "ledger.receipts_about": "Every job GigSync keeps for you, with what you paid, to show anyone.",
  "ledger.receipts_empty": "No jobs kept yet. Jobs that you and the worker both signed show here.",
  "ledger.col_paid": "Paid, confirmed (₹)",
  "ledger.by_worker": "The worker only",
  // My record, from the worker's Me
  "ledger.record_none": "Jobs you and a household both sign are added here.",
  "ledger.on_card": "On your card",
  "ledger.share_lead": "Share a part of it, when you choose to.",
  "ledger.share_card": "Show my card",
  "ledger.share_card_sub": "Jobs done and your rating, no amounts",
  "ledger.share_job": "Receipts for one job",
  "ledger.share_job_sub": "One job's record as a file, to show anyone",
  "ledger.job_missing": "GigSync keeps no record of this job yet. Try again later.",
} as const;
