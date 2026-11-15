/**
 * Checking the one enveloped XML signature (https://www.w3.org/TR/xmldsig-core1/) on a UIDAI e-KYC file, the way
 * UIDAI signs it: one Signature right under the document element, one Reference with URI="" (the whole document
 * less the signature), the enveloped-signature transform, Canonical XML 1.0, an RSA PKCS#1 v1.5 signature over SHA-1
 * or SHA-256. Anything else is refused rather than half-checked, which also rules out signature wrapping: the data
 * read afterwards is the very document that was digested. KeyInfo is ignored: a forger can put any key there, so only
 * the keys the caller passes count.
 */
import { canonicalize, type Namespaces, scopeOf } from "./c14n.js";
import { sameBytes } from "./qr-bytes.js";
import { SignatureHash } from "./uidai-key.js";
import type { XmlElement, XmlNode } from "./xml-tree.js";

const DSIG = "http://www.w3.org/2000/09/xmldsig#";
const Algorithm = {
  c14n: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  enveloped: "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
} as const;
// Maps, not objects: the keys come from the file, and "constructor" must not find Object's.
const SIGNATURE_HASHES: ReadonlyMap<string, SignatureHash> = new Map([
  ["http://www.w3.org/2000/09/xmldsig#rsa-sha1", SignatureHash.sha1],
  ["http://www.w3.org/2001/04/xmldsig-more#rsa-sha256", SignatureHash.sha256],
]);
const DIGEST_HASHES: ReadonlyMap<string, SignatureHash> = new Map([
  ["http://www.w3.org/2000/09/xmldsig#sha1", SignatureHash.sha1],
  ["http://www.w3.org/2001/04/xmlenc#sha256", SignatureHash.sha256],
]);
const Name = {
  signature: "Signature",
  signedInfo: "SignedInfo",
  signatureValue: "SignatureValue",
  canonicalization: "CanonicalizationMethod",
  signatureMethod: "SignatureMethod",
  reference: "Reference",
  transforms: "Transforms",
  transform: "Transform",
  digestMethod: "DigestMethod",
  digestValue: "DigestValue",
} as const;
const ALGORITHM = "Algorithm";
const URI = "URI";
const COLON = ":";
const NO_PREFIX = "";
const RSA = "RSASSA-PKCS1-v1_5";
const WHITESPACE = /\s+/g;

/** What came of the check: signed by one of the keys, not signed as UIDAI signs, or signed but not matching. */
export const DsigResult = { valid: "valid", unsigned: "unsigned", mismatch: "mismatch" } as const;
export type DsigResult = (typeof DsigResult)[keyof typeof DsigResult];

/** The keys to try, imported for the hash the file's SignatureMethod names. */
export type KeysFor = (hash: SignatureHash) => Promise<readonly CryptoKey[]>;

interface Located {
  readonly element: XmlElement;
  readonly scope: Namespaces;
}

const elements = (nodes: readonly XmlNode[]) => nodes.filter((n): n is XmlElement => typeof n !== "string");
const textOf = (element: XmlElement) => element.children.filter((n) => typeof n === "string").join("");
const attribute = (element: XmlElement, name: string) => element.attributes.find((a) => a.name === name)?.value;

/** Whether `element`, in `around`, is the XML-DSig element `local`. */
function isDsig(element: XmlElement, around: Namespaces, local: string): boolean {
  const colon = element.name.indexOf(COLON);
  const prefix = colon < 0 ? NO_PREFIX : element.name.slice(0, colon);
  const name = colon < 0 ? element.name : element.name.slice(colon + 1);
  return name === local && scopeOf(element, around).get(prefix) === DSIG;
}

/** The element children of `parent`, which must be exactly the XML-DSig elements `locals`, in order. */
function exactly(parent: Located, ...locals: string[]): Located[] | undefined {
  const children = elements(parent.element.children);
  if (children.length !== locals.length) return undefined;
  const located = children.map((element) => ({ element, scope: scopeOf(element, parent.scope) }));
  return located.every((c, i) => isDsig(c.element, parent.scope, locals[i] ?? NO_PREFIX)) ? located : undefined;
}

/** How many elements in the tree are XML-DSig Signatures: an e-KYC file has exactly one. */
function countSignatures(element: XmlElement, around: Namespaces): number {
  const scope = scopeOf(element, around);
  const own = isDsig(element, around, Name.signature) ? 1 : 0;
  return elements(element.children).reduce((n, child) => n + countSignatures(child, scope), own);
}

const base64Bytes = (text: string): Uint8Array<ArrayBuffer> | undefined => {
  try {
    return Uint8Array.from(atob(text.replace(WHITESPACE, "")), (c) => c.charCodeAt(0));
  } catch {
    return undefined;
  }
};

/** Whether `root` carries one enveloped signature, made by one of `keysFor`'s keys over this very document. */
export async function checkEnveloped(root: XmlElement, keysFor: KeysFor): Promise<DsigResult> {
  const rootScope = scopeOf(root, new Map());
  if (countSignatures(root, new Map()) !== 1) return DsigResult.unsigned;
  const signature = elements(root.children).find((e) => isDsig(e, rootScope, Name.signature));
  if (!signature) return DsigResult.unsigned;
  const signatureAt = { element: signature, scope: scopeOf(signature, rootScope) };
  const parts = elements(signature.children);
  const [signedInfo, value] = parts
    .slice(0, 2)
    .map((element) => ({ element, scope: scopeOf(element, signatureAt.scope) }));
  if (!signedInfo || !value || !isDsig(signedInfo.element, signatureAt.scope, Name.signedInfo))
    return DsigResult.unsigned;
  if (!isDsig(value.element, signatureAt.scope, Name.signatureValue)) return DsigResult.unsigned;
  const info = exactly(signedInfo, Name.canonicalization, Name.signatureMethod, Name.reference);
  const [c14n, method, reference] = info ?? [];
  if (!c14n || !method || !reference) return DsigResult.unsigned;
  const hash = SIGNATURE_HASHES.get(attribute(method.element, ALGORITHM) ?? NO_PREFIX);
  const digest = digestOf(reference);
  if (attribute(c14n.element, ALGORITHM) !== Algorithm.c14n || !hash || !digest) return DsigResult.unsigned;

  const canonicalDocument = new TextEncoder().encode(canonicalize(root, { omit: signature }));
  const actual = new Uint8Array(await crypto.subtle.digest(digest.hash, canonicalDocument));
  if (!sameBytes(actual, digest.value)) return DsigResult.mismatch;
  const signedBytes = new TextEncoder().encode(canonicalize(signedInfo.element, { around: signatureAt.scope }));
  const signatureBytes = base64Bytes(textOf(value.element));
  if (!signatureBytes) return DsigResult.mismatch;
  for (const key of await keysFor(hash))
    if (await crypto.subtle.verify(RSA, key, signatureBytes, signedBytes)) return DsigResult.valid;
  return DsigResult.mismatch;
}

/** The Reference's digest hash and value, when it covers the whole document with only the allowed transforms. */
function digestOf(reference: Located): { hash: SignatureHash; value: Uint8Array } | undefined {
  if (attribute(reference.element, URI) !== NO_PREFIX) return undefined;
  const [transforms, method, value] = exactly(reference, Name.transforms, Name.digestMethod, Name.digestValue) ?? [];
  if (!transforms || !method || !value) return undefined;
  const algorithms = elements(transforms.element.children).map((step) =>
    isDsig(step, transforms.scope, Name.transform) ? attribute(step, ALGORITHM) : undefined,
  );
  if (!algorithms.includes(Algorithm.enveloped)) return undefined;
  if (algorithms.some((a) => a !== Algorithm.enveloped && a !== Algorithm.c14n)) return undefined;
  const hash = DIGEST_HASHES.get(attribute(method.element, ALGORITHM) ?? NO_PREFIX);
  const bytes = base64Bytes(textOf(value.element));
  return hash && bytes ? { hash, value: bytes } : undefined;
}
