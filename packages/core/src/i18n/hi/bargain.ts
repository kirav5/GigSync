import type { bargain as en } from "../en/bargain.js";

/** Hindi: how the agent bargains, the owner's usual pace. */
export const bargain: Readonly<Record<keyof typeof en, string>> = {
  "bargain.label": "आपका एजेंट आम तौर पर कैसे मोलभाव करे",
  "bargain.what":
    "आपका एजेंट हर काम में थोड़ा अलग दाम से शुरू करता है और अलग ढंग से झुकता है, ताकि कोई आपकी सीमा का अंदाज़ा न लगा सके। यह उसकी आम रफ़्तार है; वह आपकी सीमा से आगे कभी नहीं जाता।",
  "bargain.patient": "धीरज से",
  "bargain.steady": "संतुलित",
  "bargain.quick": "जल्दी",
};
