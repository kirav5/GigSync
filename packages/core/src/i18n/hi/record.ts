import type { record as en } from "../en/record.js";

/** Hindi: the worker's record inside Passbook. */
export const record: Readonly<Record<keyof typeof en, string>> = {
  "record.title": "किए गए काम",
  "record.jobs.one": "{count} काम किया",
  "record.jobs.other": "{count} काम किए",
  "record.households.one": "{count} घर",
  "record.households.other": "{count} घर",
  "record.since": "{month} से",
  "record.state_received": "{price} मिले",
  "record.state_cash": "{price} नक़द मिले",
  "record.state_waiting": "पैसों का इंतज़ार",
  "record.state_not_asked": "अभी माँगे नहीं",
  "record.state_cancelled": "रद्द हुआ",
  "record.open": "यह काम देखें",
  "record.close": "यह काम छिपाएँ",
  "record.empty": "GigSync पर पूरे किए काम यहाँ दिखेंगे।",
};
