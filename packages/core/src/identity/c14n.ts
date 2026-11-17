/**
 * Canonical XML 1.0 without comments (https://www.w3.org/TR/2001/REC-xml-c14n-20010315), the form UIDAI's e-KYC
 * signature is computed over: no XML declaration, every empty element written as a start and an end tag, attributes in
 * one order, the same escaping everywhere, and the namespace declarations in scope written where they first apply.
 * Only what the e-KYC file can hold is handled: elements, attributes and text (xml-tree.ts drops comments and refuses
 * the rest). Inherited xml:* attributes, which an apex in a subset would also take, are not: UIDAI's file has none.
 */
import type { XmlElement } from "./xml-tree.js";

/** Namespace prefix to URI; "" is the default namespace, and "" as a URI undeclares it. */
export type Namespaces = ReadonlyMap<string, string>;

const XMLNS = "xmlns";
const XMLNS_PREFIX = "xmlns:";
const XML_PREFIX = "xml";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const DEFAULT = "";
const COLON = ":";

const TEXT_ESCAPES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\r": "&#xD;" };
const ATTRIBUTE_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  '"': "&quot;",
  "\t": "&#x9;",
  "\n": "&#xA;",
  "\r": "&#xD;",
};
const TEXT_SPECIAL = /[&<>\r]/g;
const ATTRIBUTE_SPECIAL = /[&<"\t\n\r]/g;

const escapeText = (text: string) => text.replace(TEXT_SPECIAL, (c) => TEXT_ESCAPES[c] ?? c);
const escapeAttribute = (text: string) => text.replace(ATTRIBUTE_SPECIAL, (c) => ATTRIBUTE_ESCAPES[c] ?? c);

/** The prefix an `xmlns` or `xmlns:p` attribute declares, or undefined for any other attribute. */
function declaredPrefix(name: string): string | undefined {
  if (name === XMLNS) return DEFAULT;
  return name.startsWith(XMLNS_PREFIX) ? name.slice(XMLNS_PREFIX.length) : undefined;
}

/** The namespaces in scope inside `element`, given those in scope around it. */
export function scopeOf(element: XmlElement, around: Namespaces): Namespaces {
  const scope = new Map(around);
  for (const { name, value } of element.attributes) {
    const prefix = declaredPrefix(name);
    if (prefix !== undefined) scope.set(prefix, value);
  }
  return scope;
}

export interface CanonicalOptions {
  /** The namespaces declared on the element's ancestors: none for a whole document. */
  readonly around?: Namespaces;
  /** One descendant left out with all it holds: the enveloped signature, for the document's digest. */
  readonly omit?: XmlElement;
}

/** `element` and everything in it as canonical XML. */
export function canonicalize(element: XmlElement, options: CanonicalOptions = {}): string {
  const out: string[] = [];
  write(element, options.around ?? new Map(), new Map(), options.omit, out);
  return out.join("");
}

function write(
  element: XmlElement,
  around: Namespaces,
  rendered: Namespaces,
  omit: XmlElement | undefined,
  out: string[],
) {
  const scope = scopeOf(element, around);
  const shown = new Map(rendered);
  const declarations: [string, string][] = [];
  for (const [prefix, uri] of scope) {
    // xmlns="" is written only to undo a default namespace an output ancestor wrote.
    const before = rendered.get(prefix) ?? DEFAULT;
    if (prefix === DEFAULT && uri === DEFAULT ? before === DEFAULT : rendered.get(prefix) === uri) continue;
    declarations.push([prefix, uri]);
    shown.set(prefix, uri);
  }
  declarations.sort(([a], [b]) => compare(a, b));
  const attributes = element.attributes
    .filter(({ name }) => declaredPrefix(name) === undefined)
    .map((a) => ({ ...a, key: attributeKey(a.name, scope) }))
    .sort((a, b) => compare(a.key[0], b.key[0]) || compare(a.key[1], b.key[1]));

  out.push(`<${element.name}`);
  for (const [prefix, uri] of declarations)
    out.push(` ${prefix === DEFAULT ? XMLNS : XMLNS_PREFIX + prefix}="${escapeAttribute(uri)}"`);
  for (const { name, value } of attributes) out.push(` ${name}="${escapeAttribute(value)}"`);
  out.push(">");
  for (const child of element.children) {
    if (typeof child === "string") out.push(escapeText(child));
    else if (child !== omit) write(child, scope, shown, omit, out);
  }
  out.push(`</${element.name}>`);
}

/** How C14N orders an attribute: by its namespace URI (none for an unprefixed one), then its local name. */
function attributeKey(name: string, scope: Namespaces): [string, string] {
  const colon = name.indexOf(COLON);
  if (colon < 0) return [DEFAULT, name];
  const prefix = name.slice(0, colon);
  const uri = prefix === XML_PREFIX ? XML_NAMESPACE : (scope.get(prefix) ?? DEFAULT);
  return [uri, name.slice(colon + 1)];
}

/** Ordering by UTF-16 code unit, which matches C14N's code-point order for the ASCII names a signature uses. */
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
