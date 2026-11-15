/**
 * UIDAI's public keys for Secure QR signatures, each as base64 SPKI (DER) with the certificate it came from. A card is
 * signed with the key UIDAI used when it was printed, so every published offline key stays here, newest first; the
 * check tries each (docs/setup/uidai-secure-qr-key.md).
 *
 * Downloaded 15 Nov 2026 from UIDAI's Data and Downloads page, https://uidai.gov.in/en/data-and-download ("UIDAI
 * Certificates Details"), each from https://backend.uidai.gov.in/get/files/media/document/2026-07/<certificate>.
 * Every one is issued to "DS Unique Identification Authority of India" (O=UNIQUE IDENTIFICATION AUTHORITY OF INDIA,
 * New Delhi) by (n)Code Solutions, a licensed Indian certifying authority; RSA 2048. The certificates' own dates and
 * SHA-256 fingerprints:
 * - 2026:     3 Feb 2026 – 3 Feb 2029, E0:30:4B:9E:61:EE:36:40:…:2F:86:AC:5C:04:F2:77:DF
 * - 17022026: 21 Feb 2024 – 16 Feb 2026, 00:57:3C:69:2C:F0:4F:BE:…:60:08:90:6B:36:DF:81:69
 * - 26022021: 26 Feb 2021 – 27 Feb 2024, E0:F0:F8:69:D3:2E:FC:7E:…:49:E5:BD:5A:BF:1C:0F:7D
 * - 29032019: 15 Mar 2019 – 28 Feb 2021, E0:F5:59:6D:2C:48:E1:9F:…:D1:85:1C:35:C6:22:D8:52
 * - 26022019: 27 Apr 2017 – 9 Apr 2019,  35:57:5C:63:C7:21:06:E8:…:1A:AD:61:F1:96:4C:58:D0
 * The expired ones stay: a card printed while one was current carries its signature, which never expires. Not
 * okyc-publickey.cer from the Paperless Offline e-KYC page: that is an expired "hcl-aua" test certificate.
 */
export const UIDAI_SECURE_QR_KEYS: readonly { readonly certificate: string; readonly spki: string }[] = [
  {
    certificate: "uidai_offline_publickey_2026.cer",
    spki: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAh1+zYnvbcEm0Yz73s5u42odpUJMr9wv5bVw7sOE5nFNbrB+U++5I0f8cL2HoHnJOkwvLZzrD0jG/vxAKi6vii/gjEzUEgrkdIHxMP3D6GJs0MSQHiEXvIGOwPIH3BLtBOc3m28NVNT6Q9iq0gUwuxnlhV38UdNhCllqNYhWmAMPJkImgaKrRZvY2pWNs6gd+PlAF/9SO69x3+1meA8kPk2ZvQanZlx9tfaExeOe9or3NQiKy2+UbtXrpcoAfYbbWi1OUzXi5bJdhbGp239c1fX6UKyUM5IUMY+m3I7wu2WQ7lmeO2n/vwzQz/PKHXPWYu3bydWMLdCi07vOQBqzCKwIDAQAB",
  },
  {
    certificate: "uidai_offline_publickey_17022026.cer",
    spki: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAmMIJKj28JcTN1B72p2/pgzDCoguhs/rbIXgN/ybNNh0NVOrZV2KllrmT5VOYlMrABpvIp7JU/n6hma3/O14n7nvngJ/y3colh8rk7msDwVAO7ZuVD+GCzfaYPLLkUS+wqH7M7FOHIn/pyJo1Rkxm98lO3dyox5RuLG2Uqm7JfVIomm0t7QKJoM5rf8JNvPXdwsxN89eWlT2Bf7BF//G3FKiF7ZHfvIyyqte/3orRRG/M80QqLrDP1RIeOa53ZTgILXcyQOb2yZOqNH3iN2uSKRsusNO17To5FOb2J9Hd5wIMuDv3zw4MWTrKAWuTYon90QSeGRKv1d5AQNRt0x5dSwIDAQAB",
  },
  {
    certificate: "uidai_offline_publickey_26022021.cer",
    spki: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAonIsDl8t5bpwftk/A27CsfC5VZMjkPrMDwvL8gyAoVwIi0iGhmty6yWrC/VaL+Brae29XMg7dMdwnbIUHmwHxovN+FnT2vfz/O0kHQcgVdwVSIR0tFwsmC+pVKpSqm//skgYYcZQhdhLZBWOn0PZ81ymm0jOkwBSIQKkyuCTv/1HSwjTLR0EBvaH9+Vb0iaiOEv1ikHDhMOXTxx8URWBnJJt463z7LuZBMSG8fXVMDl3vqY1hDZzKbXBaK/clRIXMff0jUOvfPMfabHju+eUnceosQwL3eurq96+oHahz4FmrfBqikHe3xQ7/4NdvSvVuwth0kcsI0ptRBG8m1NglQIDAQAB",
  },
  {
    certificate: "uidai_offline_publickey_29032019.cer",
    spki: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAm3ajjc3OQhTkP92CnmYEjXAwVG0KE5AHu6e5hlx1t2zp6ys9pOVlzVTLdRFWj3yLRbSePe75e2UTet0JUCraF7/NrXsARPyjDoVcTTlyj+JEcOYI7VUwg9e35Xp47ADNso6HzHhG1FJ9DMylWMP7ewob/Z0Lnbp1M4ZYGTBE/bZwrfORmZjl8ZKzExd2uzSDGu9qcX0B6bCLvxlwKSobfCtTgWIoZP06+HcKuJ570fi6Z8W7epbL/OPf92eKUyy39W00KZceuHFGonwhLCF/4t7aMySrpVf65wla8dO2NvXylWRyV7j6rR6DnUSFQZSOgZuJyPxMLS3fEzIEOd82WQIDAQAB",
  },
  {
    certificate: "uidai_offline_publickey_26022019.cer",
    spki: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvVU9vwpfi5Qw/7KbqFeQWIu+mora/myGB2drvtYg+YWU7GfpXhTYeeAvaXlfFir1jPoIQLXgUIZ3Q6CHPEXbAddT3/kF3tHIZ6A1RrFZr2T+0VJpk6QAj8kYwyOwUwZzvQFrKTV5XvH8CWLGiCy7fsMBowqNpoN+lBVD1mvnNckOEQ2WtcWMn5kxRWGqACPRQmbioZE6FPJp0ZaxO84xA3l5TP590qXj9G2f/qxaNmuUm4/P8S+T6gxhZlWfBVeH9al2MR77VedOFyRm4+AYPUzHoY7nVbJAdIxOGA7HO0wcHDyMOeKWAsCuxLcE1WCSEnLeDia/J21QCWrKCBnXHwIDAQAB",
  },
];

/** The RSA signature scheme UIDAI signs Secure QR data with: PKCS#1 v1.5 over SHA-256. */
export const SECURE_QR_SIGNATURE = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" } as const;

/** Whether this build can check an Aadhaar at all; the screen leaves the step out when it cannot. */
export const idCheckAvailable = (): boolean => UIDAI_SECURE_QR_KEYS.length > 0;

/** The hashes UIDAI's RSA signatures are made over: SHA-256 on a Secure QR, SHA-1 or SHA-256 on an e-KYC file. */
export const SignatureHash = { sha1: "SHA-1", sha256: "SHA-256" } as const;
export type SignatureHash = (typeof SignatureHash)[keyof typeof SignatureHash];

/** One base64 SPKI key, ready for WebCrypto to verify RSA PKCS#1 v1.5 signatures over `hash`. */
export function importSpki(spki: string, hash: SignatureHash): Promise<CryptoKey> {
  const der = Uint8Array.from(atob(spki), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("spki", der, { name: SECURE_QR_SIGNATURE.name, hash }, false, ["verify"]);
}

/**
 * UIDAI's keys, ready for WebCrypto, newest first; empty while none is pasted in. WebCrypto ties a key to one hash
 * when it is imported, so an e-KYC file signed with SHA-1 needs the same keys imported again for SHA-1.
 */
export function uidaiKeys(hash: SignatureHash = SECURE_QR_SIGNATURE.hash): Promise<CryptoKey[]> {
  return Promise.all(UIDAI_SECURE_QR_KEYS.map(({ spki }) => importSpki(spki, hash)));
}
