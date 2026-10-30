import type { money as en } from "../en/money.js";

/** Hindi: the passbook of jobs signed on GigSync, and the worker's money actions inside a job. */
export const money: Readonly<Record<keyof typeof en, string>> = {
  "passbook.headline": "आपकी कमाई।",
  "passbook.soft": "सिर्फ़ GigSync पर तय हुए काम।",
  "passbook.week": "इस हफ़्ते मिले",
  "passbook.month": "इस महीने मिले",
  "passbook.not_asked": "अभी तक माँगे नहीं",
  "passbook.empty": "GigSync पर तय हुए कामों के पैसे यहाँ दिखेंगे।",
  "passbook.about": "हर लाइन ऐसा काम है जिस पर आपने और ग्राहक, दोनों ने दस्तख़त किए। यह सब इसी फ़ोन पर रहता है।",
  "money.ask_again": "फिर से पैसे माँगें",
  "money.ask_month": "इस महीने के पैसे माँगें",
  "money.show_qr": "मेरा क्यूआर दिखाएँ",
  "money.hide_qr": "क्यूआर छिपाएँ",
  "money.cash_confirm": "{price} नक़द मिले, यह दर्ज करें?",
  "money.need_upi": "ग्राहक जिस यूपीआई आईडी पर पैसे भेजते हैं, उसे “मेरे बारे में” में जोड़ें।",
  "money.add_upi": "यूपीआई आईडी जोड़ें",
  "money.nudge": "काम ख़त्म होने से पहले अपना यूपीआई आईडी जोड़ लें, ताकि ग्राहक तुरंत पैसे दे सकें।",
  "money.waiting": "{name} के {price} भेजने का इंतज़ार है।",
  "money.asked_at": "{time} पर माँगे",
  "money.already_in_bank": "पैसे मेरे बैंक में आ चुके हैं",
  "money.bank_confirm": "{price} मिल गए, यह दर्ज करें?",
};
