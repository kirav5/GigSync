import type { net as en } from "../en/net.js";

/** Hindi: what the app says when the server does not answer or the phone has no internet. */
export const net: Readonly<Record<keyof typeof en, string>> = {
  "net.timeout": "GigSync से जवाब नहीं आया। इंटरनेट देखें और फिर कोशिश करें।",
  "net.offline": "आप ऑफ़लाइन हैं। इंटरनेट मिलने पर फिर कोशिश करें।",
};
