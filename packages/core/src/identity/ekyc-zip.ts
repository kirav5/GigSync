/**
 * Opening the ZIP UIDAI's myAadhaar gives for Paperless Offline e-KYC: one XML file, locked with the share code the
 * person set (ZipCrypto or WinZip AES). Read per PKWARE's APPNOTE.TXT from the central directory, since a streamed
 * ZIP leaves the sizes and CRC out of the local header. Nothing is logged; every buffer but the result is wiped.
 */
import { inflate } from "./qr-bytes.js";
import { AesProblem, zipAesDecrypt } from "./zip-aes.js";
import { crc32, highByte, ZIP_CRYPTO_HEADER, zipCryptoDecrypt } from "./zip-crypto.js";

/** Bytes in the biggest e-KYC ZIP we open: a real one is tens of KB (the XML and a small photo). */
export const MAX_EKYC_ZIP_BYTES = 2 * 1024 * 1024;
/** Bytes the XML may unzip to; more is a zip bomb, not an e-KYC file. */
const MAX_EKYC_XML_BYTES = 2 * 1024 * 1024;
/** The longest share code we try: UIDAI's are 4 characters, and its page shows longer "share phrases". */
export const MAX_SHARE_CODE_LENGTH = 64;

const Signature = { endOfDirectory: 0x06054b50, directoryEntry: 0x02014b50, localHeader: 0x04034b50 } as const;
const Method = { stored: 0, deflate: 8, winzipAes: 99 } as const;
/** Where each field sits in the end record, a central directory entry and a local header (APPNOTE 4.3). */
const EndAt = { entries: 10, directoryAt: 16 } as const;
const DirAt = {
  flags: 8,
  method: 10,
  modTime: 12,
  crc: 16,
  packedSize: 20,
  nameLength: 28,
  extraLength: 30,
  localAt: 42,
} as const;
const LocalAt = { nameLength: 26, extraLength: 28 } as const;
/** An extra field's header: its id and its length, 2 bytes each. */
const EXTRA_HEADER = 4;
const BYTE = 0xff;
const Flag = { encrypted: 0x1, dataDescriptor: 0x8, strongEncryption: 0x40 } as const;
/** WinZip AES's extra field: header id, then its version, "AE", the strength byte and the real method. */
const AES_EXTRA = 0x9901;
const AES_EXTRA_STRENGTH = 4;
const AES_EXTRA_METHOD = 5;
/** AE-1 keeps the CRC; AE-2 writes 0 there and relies on the HMAC alone. */
const AE_1 = 1;
const END_RECORD_BYTES = 22;
const MAX_COMMENT_BYTES = 0xffff;
const DIRECTORY_ENTRY_BYTES = 46;
const LOCAL_HEADER_BYTES = 30;
const SHIFT_BYTE = 8;
const XML_NAME = /^[^/\\]+\.xml$/i;
const latin1 = new TextDecoder("latin1");

/** Why a file did not give its XML: not a ZIP holding one XML file, or a share code that does not open it. */
export const ZipProblem = { not_ekyc_zip: "not_ekyc_zip", wrong_share_code: "wrong_share_code" } as const;
export type ZipProblem = (typeof ZipProblem)[keyof typeof ZipProblem];

export type Unzipped =
  | { readonly ok: true; readonly xml: Uint8Array<ArrayBuffer> }
  | { readonly ok: false; readonly problem: ZipProblem };

interface Entry {
  readonly flags: number;
  readonly method: number;
  readonly modTime: number;
  readonly crc: number;
  readonly packedSize: number;
  readonly localAt: number;
  readonly aes?: { readonly strength: number; readonly version: number; readonly method: number };
}

const notZip: Unzipped = { ok: false, problem: ZipProblem.not_ekyc_zip };
const wrongCode: Unzipped = { ok: false, problem: ZipProblem.wrong_share_code };

/** The XML inside an e-KYC ZIP, opened with the share code, or why it could not be. */
export async function unzipEkyc(zip: Uint8Array<ArrayBuffer>, shareCode: string): Promise<Unzipped> {
  if (zip.length > MAX_EKYC_ZIP_BYTES) return notZip;
  if (!shareCode || shareCode.length > MAX_SHARE_CODE_LENGTH) return wrongCode;
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const entry = onlyEntry(zip, view);
  if (!entry || entry.flags & Flag.strongEncryption) return notZip;
  if (entry.localAt + LOCAL_HEADER_BYTES > zip.length || u32(view, entry.localAt) !== Signature.localHeader)
    return notZip;
  const dataAt =
    entry.localAt +
    LOCAL_HEADER_BYTES +
    u16(view, entry.localAt + LocalAt.nameLength) +
    u16(view, entry.localAt + LocalAt.extraLength);
  if (dataAt + entry.packedSize > zip.length) return notZip;
  const sealed = zip.subarray(dataAt, dataAt + entry.packedSize);
  const password = new TextEncoder().encode(shareCode);
  try {
    return await open(entry, sealed, password);
  } finally {
    password.fill(0);
  }
}

async function open(entry: Entry, sealed: Uint8Array<ArrayBuffer>, password: Uint8Array): Promise<Unzipped> {
  const encrypted = (entry.flags & Flag.encrypted) !== 0;
  if (entry.aes) {
    if (!encrypted) return notZip;
    const opened = await zipAesDecrypt(sealed, entry.aes.strength, password);
    if (!opened.ok) return opened.problem === AesProblem.wrong_password ? wrongCode : notZip;
    return unpack(opened.bytes, entry.aes.method, entry.aes.version === AE_1 ? entry.crc : undefined, notZip);
  }
  if (!encrypted) return unpack(sealed.slice(), entry.method, entry.crc, notZip);
  const check = entry.flags & Flag.dataDescriptor ? (entry.modTime >>> SHIFT_BYTE) & BYTE : highByte(entry.crc);
  const plain = zipCryptoDecrypt(sealed, password, check);
  if (!plain) return wrongCode;
  // One wrong code in 256 passes the check byte; it then fails to inflate or to match the CRC.
  return unpack(plain.slice(ZIP_CRYPTO_HEADER), entry.method, entry.crc, wrongCode, plain);
}

/** The entry's bytes uncompressed and matched against its CRC; `failed` says what a mismatch means. */
async function unpack(
  packed: Uint8Array<ArrayBuffer>,
  method: number,
  crc: number | undefined,
  failed: Unzipped,
  ...wipe: Uint8Array[]
): Promise<Unzipped> {
  try {
    let xml: Uint8Array<ArrayBuffer> | undefined;
    if (method === Method.stored) xml = packed.length <= MAX_EKYC_XML_BYTES ? packed.slice() : undefined;
    else if (method === Method.deflate) xml = await inflate(packed, "deflate-raw", MAX_EKYC_XML_BYTES);
    else return notZip;
    if (!xml) return failed;
    if (crc !== undefined && crc32(xml) !== crc) {
      xml.fill(0);
      return failed;
    }
    return { ok: true, xml };
  } finally {
    packed.fill(0);
    for (const bytes of wipe) bytes.fill(0);
  }
}

/** The one entry of a ZIP holding a single .xml file, read from its central directory; undefined otherwise. */
function onlyEntry(zip: Uint8Array, view: DataView): Entry | undefined {
  const end = endRecord(zip, view);
  if (end === undefined || u16(view, end + EndAt.entries) !== 1) return undefined;
  const at = u32(view, end + EndAt.directoryAt);
  if (at + DIRECTORY_ENTRY_BYTES > zip.length || u32(view, at) !== Signature.directoryEntry) return undefined;
  const nameLength = u16(view, at + DirAt.nameLength);
  const extraLength = u16(view, at + DirAt.extraLength);
  const nameAt = at + DIRECTORY_ENTRY_BYTES;
  if (nameAt + nameLength + extraLength > zip.length) return undefined;
  if (!XML_NAME.test(latin1.decode(zip.subarray(nameAt, nameAt + nameLength)))) return undefined;
  const method = u16(view, at + DirAt.method);
  const aes = method === Method.winzipAes ? aesField(view, nameAt + nameLength, extraLength) : undefined;
  if (method === Method.winzipAes && !aes) return undefined;
  return {
    flags: u16(view, at + DirAt.flags),
    method,
    modTime: u16(view, at + DirAt.modTime),
    crc: u32(view, at + DirAt.crc),
    packedSize: u32(view, at + DirAt.packedSize),
    localAt: u32(view, at + DirAt.localAt),
    ...(aes ? { aes } : {}),
  };
}

/** Where the end-of-central-directory record starts: within the last 22 bytes plus the longest comment. */
function endRecord(zip: Uint8Array, view: DataView): number | undefined {
  const last = zip.length - END_RECORD_BYTES;
  for (let at = last; at >= 0 && at >= last - MAX_COMMENT_BYTES; at--)
    if (u32(view, at) === Signature.endOfDirectory) return at;
  return undefined;
}

/** The WinZip AES extra field's strength, version and real method, if the entry's extra data holds one. */
function aesField(view: DataView, from: number, length: number): Entry["aes"] {
  const end = from + length;
  for (let at = from; at + EXTRA_HEADER <= end; at += EXTRA_HEADER + u16(view, at + EXTRA_HEADER / 2)) {
    const body = at + EXTRA_HEADER;
    if (u16(view, at) !== AES_EXTRA || body + AES_EXTRA_METHOD + 2 > end) continue;
    return {
      version: u16(view, body),
      strength: view.getUint8(body + AES_EXTRA_STRENGTH),
      method: u16(view, body + AES_EXTRA_METHOD),
    };
  }
  return undefined;
}

const u16 = (view: DataView, at: number) => view.getUint16(at, true);
const u32 = (view: DataView, at: number) => view.getUint32(at, true);
