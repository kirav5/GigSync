/** The worker's record: inside Passbook, every finished job both sides signed; on their card, jobs done and the rating. */
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
  // On the worker's card, for households to see (ADR 0036)
  "record.card_label": "Work record",
  "record.card_jobs": "Jobs done",
  "record.card_rated.one": "{count} rating",
  "record.card_rated.other": "{count} ratings",
  "record.card_not_rated": "Not yet rated",
  "record.card_stars": "★ {stars}",
  "record.card_no_stars": "–",
  "record.card_hidden": "Households do not see these numbers. You can show them in Privacy.",
  "record.setting": "Show my record on my card",
  "record.setting_about":
    "Jobs done and households' ratings, for households to see on your card. All of it or none: a single rating cannot be hidden.",
} as const;
