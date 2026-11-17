/**
 * The traditional PKWARE ("ZipCrypto") cipher of the ZIP format, decrypt only, and the CRC-32 it is built on
 * (PKWARE APPNOTE.TXT, section 6.1). Weak by today's standards, but it is one of the two ways a UIDAI e-KYC ZIP can
 * be locked with its share code; the other is WinZip AES (zip-aes.ts).
 */

/** The 12 random bytes ZipCrypto puts before the data; the last one checks the password. */
export const ZIP_CRYPTO_HEADER = 12;

const CRC_POLYNOMIAL = 0xedb88320;
const BYTE = 0xff;
const BITS_PER_BYTE = 8;
const HIGH_BYTE_SHIFT = 24;
const CRC_START = 0xffffffff;
/** The three keys every ZipCrypto stream starts from (APPNOTE 6.1.5). */
const KEY_START: readonly [number, number, number] = [0x12345678, 0x23456789, 0x34567890];
/** The linear-congruential step of key 1. */
const KEY1_MULTIPLIER = 134775813;
const STREAM_LOW_BIT = 2;
const WORD = 0xffff;

const CRC_TABLE = Uint32Array.from({ length: BYTE + 1 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < BITS_PER_BYTE; bit++) c = c & 1 ? CRC_POLYNOMIAL ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crcStep = (crc: number, byte: number) => ((CRC_TABLE[(crc ^ byte) & BYTE] ?? 0) ^ (crc >>> BITS_PER_BYTE)) >>> 0;

/** The CRC-32 a ZIP records for an entry's uncompressed bytes. */
export function crc32(bytes: Uint8Array): number {
  let crc = CRC_START;
  for (const byte of bytes) crc = crcStep(crc, byte);
  return (crc ^ CRC_START) >>> 0;
}

/** The high byte of a 32-bit value: what ZipCrypto's last header byte must equal. */
export const highByte = (value: number) => (value >>> HIGH_BYTE_SHIFT) & BYTE;

/**
 * The 12-byte header then the data of a ZipCrypto entry decrypted with `password`, or undefined when the header's
 * check byte is not `check` (the wrong password, 255 times in 256; the caller's CRC check catches the rest).
 */
export function zipCryptoDecrypt(
  sealed: Uint8Array,
  password: Uint8Array,
  check: number,
): Uint8Array<ArrayBuffer> | undefined {
  let [k0, k1, k2] = KEY_START;
  const update = (byte: number) => {
    k0 = crcStep(k0, byte);
    k1 = (Math.imul((k1 + (k0 & BYTE)) >>> 0, KEY1_MULTIPLIER) + 1) >>> 0;
    k2 = crcStep(k2, highByte(k1));
  };
  for (const byte of password) update(byte);
  const out = new Uint8Array(sealed.length);
  for (let i = 0; i < sealed.length; i++) {
    const temp = (k2 | STREAM_LOW_BIT) & WORD;
    const plain = (sealed[i] ?? 0) ^ ((Math.imul(temp, temp ^ 1) >>> BITS_PER_BYTE) & BYTE);
    out[i] = plain;
    update(plain);
  }
  if (out[ZIP_CRYPTO_HEADER - 1] !== check) {
    out.fill(0);
    return undefined;
  }
  return out;
}
