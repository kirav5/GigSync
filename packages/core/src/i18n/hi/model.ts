import type { model as en } from "../en/model.js";

/** Hindi: the model on this phone: Settings › On-device model, and the chat's one offer and lines about it. */
export const model: Readonly<Record<keyof typeof en, string>> = {
  "model.title": "आपके एजेंट का मॉडल",
  "model.offer": "आपका एजेंट आपकी बात बेहतर समझे: इस फ़ोन पर लगभग {mb} एमबी डाउनलोड करें।",
  "model.offer_download": "डाउनलोड करें",
  "model.offer_later": "बाद में",
  "model.mobile_data": "आप मोबाइल डेटा पर हैं: इसमें लगभग {mb} एमबी डेटा लगेगा।",
  "model.wifi_best": "वाई-फ़ाई पर करना बेहतर है।",
  "model.private": "यह सिर्फ़ इसी फ़ोन पर चलता है: आप जो लिखते हैं, वह फ़ोन से बाहर नहीं जाता।",
  "model.downloading": "मॉडल इस फ़ोन पर डाउनलोड हो रहा है: {percent}% ({mb} में से {done} एमबी)",
  "model.paused": "मॉडल का डाउनलोड बीच में रुक गया। जहाँ रुका था, वहीं से आगे चलेगा।",
  "model.resume": "डाउनलोड आगे बढ़ाएँ",
  "model.ready_line": "आपका एजेंट अब इसी फ़ोन पर चलता है, बिना इंटरनेट के भी",
  "model.kept_line": "फ़ोन का अपना मॉडल · लगभग {mb} MB · {state}",
  "model.state_ready": "तैयार",
  "model.state_downloading": "डाउनलोड हो रहा है {percent}%",
  "model.remove": "इस फ़ोन से हटाएँ",
};
