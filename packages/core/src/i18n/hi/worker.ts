import type { worker as en } from "../en/worker.js";

/** Hindi: the worker's own record: Today, jobs in person, getting paid, the record, Settings. */
export const worker: Readonly<Record<keyof typeof en, string>> = {
  "stat.waiting": "बाकी",
  "getpaid.cash": "नक़द मिले",
  "getpaid.scan": "पैसे देने के लिए स्कैन करें",
  "getpaid.qr_alt": "{vpa} को {price} के लिए यूपीआई क्यूआर",
  "getpaid.to": "{name} को · {vpa}",
  "getpaid.scan_about": "ग्राहक किसी भी यूपीआई ऐप से स्कैन करें। पैसे सीधे आपके बैंक में आते हैं।",
  "payrow.ref": "रेफ़ {utr}",
  "method.upi": "यूपीआई",
  "method.cash": "नक़द",
  "settings.soft": "इसी फ़ोन पर रखी जाती है।",
  "settings.paid_to": "पैसे यहाँ लें",
  "settings.vpa": "आपका यूपीआई आईडी",
  "settings.name": "आपका नाम, जैसा ग्राहकों को दिखेगा",
  "settings.saved": "इस फ़ोन पर सेव हो गया",
  "settings.change": "बदलें",
  "settings.save": "सेव करें",
  "settings.vpa_about":
    "सिर्फ़ आपके भुगतान क्यूआर में दिखता है, या जिस ग्राहक का काम चल रहा है उसे लॉक करके भेजा जाता है। सर्वर पर कभी नहीं रखा जाता।",
  "settings.look": "रूप",
  "look.auto": "अपने-आप",
  "look.light": "हल्का",
  "look.dark": "गहरा",
  "pack.title": "समझने का पैक",
  "pack.about":
    "एक छोटा मॉडल ({mb} एमबी, एक बार डाउनलोड) जो अंग्रेज़ी, हिंदी और कन्नड़ में आपकी बात इसी फ़ोन पर समझता है। आपका लिखा कुछ भी फ़ोन से बाहर नहीं जाता, और इसके बिना भी सब कुछ चलता है।",
  "pack.get": "डाउनलोड करें ({mb} एमबी)",
  "pack.downloading": "डाउनलोड हो रहा है… {percent}%",
  "pack.ready": "तैयार · इसी फ़ोन पर चलता है",
  "pack.failed": "डाउनलोड पूरा नहीं हुआ। कनेक्शन जाँचें और फिर कोशिश करें।",
  "pack.lite": "लाइट मोड में बंद।",
  "settings.err_vpa": "यह यूपीआई आईडी जैसा नहीं लगता (name@bank)।",
  "settings.err_name": "वह नाम लिखें जो ग्राहकों को पैसे देते समय दिखेगा।",
  "settings.err_name_long": "नाम {max} अक्षरों तक रखें।",
};
