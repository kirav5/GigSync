import QRCode from "qrcode";

/** Large enough to scan from another phone at arm's length; medium error correction survives a cracked screen. */
const QR_OPTIONS = { errorCorrectionLevel: "M", margin: 2, width: 288 } as const;

/** The UPI link drawn as a QR image (a data: URL), entirely on this device. */
export function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, QR_OPTIONS);
}
