/** The worker's record inside Passbook: every finished job both sides signed. */
export const record = {
  "record.title": "Work done",
  "record.jobs.one": "{count} job done",
  "record.jobs.other": "{count} jobs done",
  "record.households.one": "{count} household",
  "record.households.other": "{count} households",
  "record.since": "since {month}",
  "record.state_received": "Received {price}",
  "record.state_cash": "Received {price} in cash",
  "record.state_waiting": "Waiting for payment",
  "record.state_not_asked": "Not asked for yet",
  "record.state_cancelled": "Cancelled",
  "record.open": "Show this job",
  "record.close": "Hide this job",
  "record.empty": "Jobs you finish on GigSync show here.",
} as const;
