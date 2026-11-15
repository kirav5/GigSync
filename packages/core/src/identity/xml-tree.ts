/**
 * A small, strict XML reader for one known document: UIDAI's Paperless Offline e-KYC file. It keeps what Canonical
 * XML needs (element names as written, attributes in order, every text node exactly, whitespace included) and refuses
 * what that file never holds and an attacker might add: a DOCTYPE or entity, processing instructions, unknown entity
 * references, duplicate attributes, deep nesting. Comments and the XML declaration are dropped, as C14N drops them.
 * It runs the same in the phone's WebView and in Node tests, which share no DOM parser.
 */

export interface XmlAttribute {
  /** The qualified name as written: `referenceId`, `xmlns`, `xmlns:ds`. */
  readonly name: string;
  readonly value: string;
}

export interface XmlElement {
  /** The qualified name as written: `Poi`, `ds:Signature`. */
  readonly name: string;
  readonly attributes: readonly XmlAttribute[];
  readonly children: readonly XmlNode[];
}

/** A text node, after entity and CDATA expansion; whitespace kept exactly. */
export type XmlNode = XmlElement | string;

/** How deep elements may nest; the e-KYC file is four levels deep. */
const MAX_DEPTH = 32;
const NAME = /[A-Za-z_][\w.:-]*/y;
const SPACE = /[ \t\n]*/y;
const ENTITY = /&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g;
/** A Map, not an object: `&constructor;` must not find Object's. */
const NAMED: ReadonlyMap<string, string> = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
]);
const HEX = 16;
const DECIMAL = 10;
const HEX_REF = "#x";
const DEC_REF = "#";
const XML_DECLARATION = /^<\?xml[ \t\n][^?]*\?>/;
const COMMENT_START = "<!--";
const COMMENT_END = "-->";
const CDATA_START = "<![CDATA[";
const CDATA_END = "]]>";
const END_TAG = "</";
const EMPTY_END = "/>";
const LT = "<";
const GT = ">";
const AMP = "&";
const ATTRIBUTE_WHITESPACE = /[\t\n]/g;
const QUOTES = new Set(['"', "'"]);
const LEADING_BOM = /^﻿/;
const LINE_END = /\r\n?/g;

/** Thrown inside the reader only; `parseXml` turns it into undefined. */
class NotXml extends Error {}
const fail = (): never => {
  throw new NotXml();
};

/** The document element of `text`, or undefined when it is not XML this reader accepts. */
export function parseXml(text: string): XmlElement | undefined {
  try {
    return new Reader(text).document();
  } catch (error) {
    if (error instanceof NotXml) return undefined;
    throw error;
  }
}

/** Every character reference and the five named entities expanded; anything else refused. */
function expand(raw: string): string {
  // A < is never data, and a bare & left over is an entity this reader does not know.
  if (raw.includes(LT) || raw.replace(ENTITY, "").includes(AMP)) fail();
  return raw.replace(ENTITY, (_, ref: string) => {
    const named = NAMED.get(ref);
    if (named) return named;
    const code = ref.startsWith(HEX_REF)
      ? Number.parseInt(ref.slice(HEX_REF.length), HEX)
      : ref.startsWith(DEC_REF)
        ? Number.parseInt(ref.slice(DEC_REF.length), DECIMAL)
        : Number.NaN;
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fail();
  });
}

class Reader {
  private at = 0;
  private readonly text: string;

  constructor(text: string) {
    // XML parsers turn CRLF and lone CR into LF before anything else (XML 1.0, 2.11).
    this.text = text.replace(LEADING_BOM, "").replace(LINE_END, "\n");
  }

  document(): XmlElement {
    const declaration = XML_DECLARATION.exec(this.text);
    if (declaration) this.at = declaration[0].length;
    this.misc();
    const root = this.element(0);
    this.misc();
    if (this.at !== this.text.length) fail();
    return root;
  }

  /** Whitespace and comments outside the document element. */
  private misc() {
    for (;;) {
      this.space();
      if (!this.text.startsWith(COMMENT_START, this.at)) return;
      this.comment();
    }
  }

  private element(depth: number): XmlElement {
    if (depth > MAX_DEPTH || !this.text.startsWith(LT, this.at)) fail();
    this.at++;
    const name = this.name();
    const attributes = this.attributes();
    if (this.text.startsWith(EMPTY_END, this.at)) {
      this.at += EMPTY_END.length;
      return { name, attributes, children: [] };
    }
    this.expect(GT);
    const children = this.content(depth);
    this.expect(END_TAG);
    if (this.name() !== name) fail();
    this.space();
    this.expect(GT);
    return { name, attributes, children };
  }

  private attributes(): XmlAttribute[] {
    const attributes: XmlAttribute[] = [];
    for (;;) {
      const before = this.at;
      this.space();
      const next = this.text[this.at];
      if (next === undefined) fail();
      if (next === GT || this.text.startsWith(EMPTY_END, this.at)) return attributes;
      if (this.at === before) fail();
      const name = this.name();
      this.space();
      this.expect("=");
      this.space();
      const quote = this.text[this.at] ?? "";
      if (!QUOTES.has(quote)) fail();
      const end = this.text.indexOf(quote, this.at + 1);
      if (end < 0) fail();
      // Attribute-value normalization (XML 1.0, 3.3.3): a literal tab or newline reads as a space.
      const value = expand(this.text.slice(this.at + 1, end).replace(ATTRIBUTE_WHITESPACE, " "));
      this.at = end + 1;
      if (attributes.some((a) => a.name === name)) fail();
      attributes.push({ name, value });
    }
  }

  private content(depth: number): XmlNode[] {
    const children: XmlNode[] = [];
    let text = "";
    const flush = () => {
      if (text) children.push(text);
      text = "";
    };
    while (!this.text.startsWith(END_TAG, this.at)) {
      if (this.at >= this.text.length) fail();
      if (this.text.startsWith(COMMENT_START, this.at)) {
        this.comment();
      } else if (this.text.startsWith(CDATA_START, this.at)) {
        const end = this.text.indexOf(CDATA_END, this.at);
        if (end < 0) fail();
        text += this.text.slice(this.at + CDATA_START.length, end);
        this.at = end + CDATA_END.length;
      } else if (this.text.startsWith(LT, this.at)) {
        flush();
        children.push(this.element(depth + 1));
      } else {
        const end = this.text.indexOf(LT, this.at);
        if (end < 0) fail();
        text += expand(this.text.slice(this.at, end));
        this.at = end;
      }
    }
    flush();
    return children;
  }

  private comment() {
    const end = this.text.indexOf(COMMENT_END, this.at + COMMENT_START.length);
    if (end < 0) fail();
    this.at = end + COMMENT_END.length;
  }

  private name(): string {
    NAME.lastIndex = this.at;
    const match = NAME.exec(this.text);
    if (!match) return fail();
    this.at += match[0].length;
    return match[0];
  }

  private space() {
    SPACE.lastIndex = this.at;
    this.at += SPACE.exec(this.text)?.[0].length ?? 0;
  }

  private expect(token: string) {
    if (!this.text.startsWith(token, this.at)) fail();
    this.at += token.length;
  }
}
