import type { records as en } from "../en/records.js";

/** Hindi: job records kept by GigSync, the notice, Privacy's rows and "My work record". */
export const records: Readonly<Record<keyof typeof en, string>> = {
  "records.notice_kept": "GigSync क्या रखता है: आपके काम, उनकी तारीख़, काम का प्रकार, दाम, भुगतान और स्टार।",
  "records.notice_why":
    "क्यों: ताकि आपके काम का रिकॉर्ड आपका रहे और आप उसे कहीं भी ले जा सकें, GigSync को बेहतर बनाने के लिए, और कामगारों को इनाम देने के लिए।",
  "records.notice_never": "हम अपने सर्वर पर फ़ोन नंबर, पता या संपर्क की जानकारी कभी नहीं रखते, न ही आपका लिखा कुछ भी।",
  "records.notice_delete": "आप अपने रिकॉर्ड कभी भी निजता में जाकर मिटा सकते हैं।",
  "records.agree": "मैं सहमत हूँ",
  "records.not_now": "अभी नहीं",
  "records.agree_failed": "GigSync से जुड़ नहीं पाए। इंटरनेट मिलने पर फिर कोशिश करें।",
  "records.signin_line": "जारी रखकर, आप GigSync की {link} से सहमत होते हैं",
  "records.signin_link": "शर्तों और गोपनीयता सूचना",
  "records.terms_title": "शर्तें और गोपनीयता सूचना",
  "records.terms_about": "आप किस बात पर सहमत हुए, और GigSync क्या रखता है और क्या कभी नहीं।",
  "records.consent_toast":
    "GigSync इस्तेमाल करने का मतलब है कि आप इसकी शर्तों और गोपनीयता सूचना से सहमत हैं। आप उन्हें सेटिंग्स में पढ़ सकते हैं।",
  "records.privacy_title": "GigSync के पास मेरे रिकॉर्ड",
  "records.privacy_kept":
    "GigSync आपके काम, तारीख़, काम का प्रकार, दाम, भुगतान और स्टार रखता है। फ़ोन नंबर, पता या आपका लिखा कभी नहीं।",
  "records.privacy_off": "GigSync आपके कामों का रिकॉर्ड नहीं रख रहा।",
  "records.privacy_agree": "पढ़ें और सहमत हों",
  "records.delete": "GigSync से मेरे रिकॉर्ड मिटाएँ",
  "records.delete_confirm_worker":
    "इससे GigSync के पास रखे आपके सारे काम, भुगतान और स्टार मिट जाएँगे, और आपके कार्ड का रिकॉर्ड शून्य हो जाएगा। आपके काम इस फ़ोन पर रहेंगे। जब तक आप फिर सहमत नहीं होते, GigSync कुछ नया नहीं रखेगा।",
  "records.delete_confirm_household":
    "इससे GigSync के पास रखे हर काम से आपका नाम हट जाएगा। कामगारों के पास उनका हिस्सा आपके बिना रहेगा। आपके काम इस फ़ोन पर रहेंगे। जब तक आप फिर सहमत नहीं होते, GigSync कुछ नया नहीं रखेगा।",
  "records.delete_yes": "मिटाएँ",
  "records.delete_cancel": "रहने दें",
  "records.deleted": "मिटा दिए। GigSync अब आपके कामों का रिकॉर्ड नहीं रखता।",
  "records.delete_failed": "मिटा नहीं पाए। इंटरनेट मिलने पर फिर कोशिश करें।",
  "records.show_failed": "बदल नहीं पाए। इंटरनेट मिलने पर फिर कोशिश करें।",
  "records.show_needs_card": "पहले अपना कार्ड बोर्ड पर लगाएँ।",
  "records.download_title": "मेरे काम का रिकॉर्ड डाउनलोड करें",
  "records.download_about": "GigSync के पास रखा आपका हर काम, किसी भी फ़ोन पर जिसमें आप साइन इन करें, किसी को भी दिखाने के लिए।",
  "records.export_loading": "आपका रिकॉर्ड ला रहे हैं…",
  "records.export_failed": "आपका रिकॉर्ड नहीं ला पाए। इंटरनेट मिलने पर फिर कोशिश करें।",
  "records.export_empty": "अभी कोई काम नहीं रखा गया। जिन कामों पर आपने और घर वालों ने दोनों ने साइन किया, वे यहाँ दिखेंगे।",
  "records.downloaded": "{file} के नाम से सहेजा गया।",
  "records.col_date": "तारीख़",
  "records.col_work": "काम",
  "records.col_price": "दाम (₹)",
  "records.col_paid": "मिले (₹)",
  "records.col_method": "भुगतान का तरीका",
  "records.col_status": "स्थिति",
  "records.col_stars": "स्टार",
  "records.status_agreed": "तय हुआ",
  "records.status_done": "पूरा हुआ",
  "records.status_cancelled": "रद्द हुआ",
  "records.col_attested": "किसने पुष्टि की",
  "records.by_both": "दोनों",
  "records.by_you": "सिर्फ़ आप",
};
