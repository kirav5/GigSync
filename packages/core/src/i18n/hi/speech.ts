import type { speech as en } from "../en/speech.js";

/** Hindi: voice: the mic, reading aloud, and the owner's consent before a cloud recognizer hears them. */
export const speech: Readonly<Record<keyof typeof en, string>> = {
  "speech.listen": "बोलकर जवाब दें",
  "speech.stop": "सुनना बंद करें",
  "speech.listening": "सुन रहा हूँ…",
  "speech.unavailable": "इस फ़ोन पर अभी {lang} में बोलकर लिखने की सुविधा नहीं है। कृपया टाइप करें।",
  "speech.download": "{lang} में बोलकर लिखना चालू करें (एक बार इसी फ़ोन पर डाउनलोड होगा)",
  "speech.denied": "GigSync माइक का इस्तेमाल नहीं कर पा रहा। फ़ोन की सेटिंग में इजाज़त दें।",
  "speech.didnt_hear": "मैं समझ नहीं पाया। फिर से बोलिए या टाइप कीजिए।",
  "speech.title": "इस फ़ोन पर आवाज़",
  "speech.about": "आप जो बोलते हैं, वह लिखे शब्दों में बदल जाता है। जहाँ हो सके, यह फ़ोन ख़ुद करता है; नहीं तो सिर्फ़ आपकी इजाज़त से।",
  "speech.listen_state": "{lang} में बोलकर लिखना: {state}",
  "speech.speak_state": "{lang} में पढ़कर सुनाना: {state}",
  "speech.replay": "फिर से सुनें",
  "speech.state_denied": "माइक की इजाज़त नहीं",
  "speech.cloud_ask":
    "यह फ़ोन अपने-आप {lang} में बोली बात नहीं समझ सकता। बोलकर लिखने के लिए आपकी आवाज़ {vendor} को भेजनी होगी, वहाँ वह लिखे शब्दों में बदली जाएगी। इजाज़त देंगे?",
  "speech.cloud_yes": "इजाज़त दें",
  "speech.cloud_no": "नहीं, टाइप करें",
  "speech.cloud_on": "आपकी आवाज़ लिखे शब्दों में बदलने के लिए {vendor} को जाती है।",
  "speech.cloud_withdraw": "मेरी आवाज़ भेजना बंद करें",
  "speech.where_device": "आवाज़ इसी फ़ोन पर रहती है।",
  "speech.where_cloud": "आवाज़ लिखे शब्दों में बदलने के लिए {vendor} को भेजी जाती है।",
  "speech.vendor_google": "गूगल",
  "speech.vendor_apple": "ऐपल",
  "speech.vendor_browser": "आपके ब्राउज़र की कंपनी",
  "speech.type_private": "यह वाला टाइप कीजिए। यह इसी फ़ोन पर रहता है, इसलिए इसे {vendor} को नहीं भेजा जाता।",
};
