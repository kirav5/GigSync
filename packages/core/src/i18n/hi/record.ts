import type { record as en } from "../en/record.js";

/** Hindi: the worker's record, in Passbook and on their card. */
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
  // On the worker's card, for households to see (ADR 0036)
  "record.card_label": "काम का रिकॉर्ड",
  "record.card_jobs": "पूरे किए काम",
  "record.card_rated.one": "{count} रेटिंग",
  "record.card_rated.other": "{count} रेटिंग",
  "record.card_not_rated": "अभी रेटिंग नहीं",
  "record.card_stars": "★ {stars}",
  "record.card_no_stars": "–",
  "record.card_hidden": "घर वालों को ये गिनती नहीं दिखती। आप इन्हें निजता में दिखा सकते हैं।",
  "record.setting": "मेरे कार्ड पर मेरा रिकॉर्ड दिखाएँ",
  "record.setting_about":
    "पूरे किए काम और घर वालों की रेटिंग, ताकि घर वाले आपके कार्ड पर देखें। सब दिखेगा या कुछ नहीं: कोई एक रेटिंग छिपाई नहीं जा सकती।",
};
