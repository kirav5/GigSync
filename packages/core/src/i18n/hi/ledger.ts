import type { ledger as en } from "../en/ledger.js";

/** Hindi: the Money and Pay tabs and the worker's record. */
export const ledger: Readonly<Record<keyof typeof en, string>> = {
  // The worker's Money tab: this week, this month, and who the money still waits on
  "ledger.week_count.one": "{count} भुगतान",
  "ledger.week_count.other": "{count} भुगतान",
  "ledger.this_month": "इस महीने",
  "ledger.today": "आज {price}",
  "ledger.waiting_from": "{name} से आना बाकी",
  "ledger.waiting_many": "{count} घरों से आना बाकी",
  "ledger.upi_line": "आपका UPI: {vpa}",
  "ledger.upi_change": "बदलें",
  "ledger.upi_none": "अभी कोई UPI ID सेव नहीं है।",
  "ledger.upi_add": "जोड़ें",
  // The household's Pay tab and the receipts it downloads
  "ledger.not_confirmed": "अभी पक्का नहीं हुआ",
  "ledger.download_receipts": "रसीदें डाउनलोड करें",
  "ledger.receipts_about": "GigSync के पास रखा आपका हर काम, आपने जो चुकाया उसके साथ, किसी को भी दिखाने के लिए।",
  "ledger.receipts_empty": "अभी कोई काम नहीं रखा गया। जिन कामों पर आपने और कामगार दोनों ने साइन किया, वे यहाँ दिखेंगे।",
  "ledger.col_paid": "चुकाए, पक्के (₹)",
  "ledger.by_worker": "सिर्फ़ कामगार",
  // My record, from the worker's Me
  "ledger.record_none": "जिन कामों पर आप और घर वाले दोनों साइन करते हैं, वे यहाँ जुड़ते हैं।",
  "ledger.on_card": "आपके कार्ड पर",
  "ledger.share_lead": "इसका एक हिस्सा शेयर करें, जब आप चाहें।",
  "ledger.share_card": "मेरा कार्ड दिखाएँ",
  "ledger.share_card_sub": "पूरे किए काम और आपकी रेटिंग, कोई रकम नहीं",
  "ledger.share_job": "एक काम की रसीदें",
  "ledger.share_job_sub": "एक काम का रिकॉर्ड फ़ाइल में, किसी को भी दिखाने के लिए",
  "ledger.job_missing": "GigSync के पास अभी इस काम का रिकॉर्ड नहीं है। बाद में फिर कोशिश करें।",
};
