import { genuine, type IdCheck, IdCheckProblem } from "./aadhaar-qr.js";
import { keptFields } from "./card-fields.js";
import { unzipEkyc, ZipProblem } from "./ekyc-zip.js";
import { hashFromHex, MobileEvidence } from "./mobile-binding.js";
import { importSpki, type SignatureHash, UIDAI_SECURE_QR_KEYS } from "./uidai-key.js";
import { checkEnveloped, DsigResult } from "./xml-dsig.js";
import { parseXml, type XmlElement } from "./xml-tree.js";

/**
 * UIDAI's Paperless Offline e-KYC file, per https://uidai.gov.in/en/aadhaar-paperless-offline-e-kyc: the document
 * element OfflinePaperlessKyc with a referenceId (the last 4 digits of the Aadhaar number, then when it was made),
 * UidData holding Poi (name, dob, gender, the e and m hashes; m is empty when no mobile is linked), Poa (the address) and Pht (the photo), and UIDAI's
 * enveloped signature. Only Poi's name, dob, gender and m and the referenceId's first 4 digits are ever read.
 */
const Ekyc = { root: "OfflinePaperlessKyc", data: "UidData", identity: "Poi" } as const;
const Attribute = {
  referenceId: "referenceId",
  name: "name",
  dateOfBirth: "dob",
  gender: "gender",
  mobileHash: "m",
} as const;

export interface EkycCheckOptions {
  /** The keys to verify against, as base64 SPKI; UIDAI's by default. Tests pass their own. */
  readonly spki?: readonly string[];
  /** Keys as base64 SPKI to try after those, for a development build's test files; none in a release build. */
  readonly extraSpki?: readonly string[];
  /** The number (E.164) the Aadhaar's mobile should match: the one the person signed in with. */
  readonly phone?: string;
  /** The time of the check; now by default. */
  readonly now?: Date;
}

const refused = (problem: IdCheckProblem): IdCheck => ({ ok: false, problem });
const ZIP_PROBLEM: Readonly<Record<ZipProblem, IdCheckProblem>> = {
  [ZipProblem.not_ekyc_zip]: IdCheckProblem.not_ekyc_file,
  [ZipProblem.wrong_share_code]: IdCheckProblem.wrong_share_code,
};
const strictUtf8 = new TextDecoder("utf-8", { fatal: true });

/**
 * Checks an Aadhaar Paperless Offline e-KYC ZIP on this phone: opens it with the share code, verifies UIDAI's
 * signature over the XML inside, and returns only the name, year of birth, gender and last 4 digits with the mobile
 * binding, like the Secure QR check (the share code stays in memory with the hash, for a second number). The share code, the XML, the address, the photo, the hashes and the rest of the reference id are never
 * returned or logged; the unzipped bytes are wiped before it returns (the decoded text, a JS string, cannot be).
 */
export async function checkAadhaarEkyc(
  zip: Uint8Array<ArrayBuffer>,
  shareCode: string,
  options: EkycCheckOptions = {},
): Promise<IdCheck> {
  const spki = [...(options.spki ?? UIDAI_SECURE_QR_KEYS.map((k) => k.spki)), ...(options.extraSpki ?? [])];
  if (spki.length === 0) return refused(IdCheckProblem.no_uidai_key);
  const unzipped = await unzipEkyc(zip, shareCode);
  if (!unzipped.ok) return refused(ZIP_PROBLEM[unzipped.problem]);
  const root = readXml(unzipped.xml);
  if (!root || root.name !== Ekyc.root || attribute(root, Attribute.referenceId) === undefined)
    return refused(IdCheckProblem.not_ekyc_file);
  const keysFor = (hash: SignatureHash) => Promise.all(spki.map((key) => importSpki(key, hash)));
  const signed = await checkEnveloped(root, keysFor);
  if (signed !== DsigResult.valid) return refused(IdCheckProblem.signature_mismatch);
  const now = options.now ?? new Date();
  const identity = child(child(root, Ekyc.data), Ekyc.identity);
  const card =
    identity &&
    keptFields(
      {
        referenceId: attribute(root, Attribute.referenceId) ?? "",
        name: attribute(identity, Attribute.name) ?? "",
        dateOfBirth: attribute(identity, Attribute.dateOfBirth) ?? "",
        gender: attribute(identity, Attribute.gender) ?? "",
      },
      now.getFullYear(),
    );
  if (!card) return refused(IdCheckProblem.not_aadhaar);
  const hash = hashFromHex(attribute(identity, Attribute.mobileHash) ?? "");
  const mobile = MobileEvidence.hashed(hash, shareCode, card.aadhaarLast4);
  return genuine({ ...card, checkedAt: now.toISOString() }, mobile, options.phone);
}

/** The document element of the unzipped XML, or undefined when it is not UTF-8 XML; the bytes are wiped either way. */
function readXml(xml: Uint8Array<ArrayBuffer>): XmlElement | undefined {
  try {
    return parseXml(strictUtf8.decode(xml));
  } catch {
    return undefined;
  } finally {
    xml.fill(0);
  }
}

const attribute = (element: XmlElement, name: string) => element.attributes.find((a) => a.name === name)?.value;

/** The one child element named `name`, or undefined when there is none or more than one. */
function child(parent: XmlElement | undefined, name: string): XmlElement | undefined {
  const found = parent?.children.filter((n): n is XmlElement => typeof n !== "string" && n.name === name) ?? [];
  return found.length === 1 ? found[0] : undefined;
}
