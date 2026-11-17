import { describe, expect, it } from "vitest";
import { canonicalize, scopeOf } from "../src/identity/c14n.js";
import { parseXml, type XmlElement } from "../src/identity/xml-tree.js";

/**
 * Canonical XML 1.0 vectors written out from the spec (https://www.w3.org/TR/2001/REC-xml-c14n-20010315) and
 * checked against libxml2's `xmllint --c14n` (which keeps comments; these expect them dropped).
 */
const c14n = (xml: string) => {
  const root = parseXml(xml);
  if (!root) throw new Error("not parsed");
  return canonicalize(root);
};
const firstChild = (e: XmlElement) => e.children.find((n): n is XmlElement => typeof n !== "string");

describe("Canonical XML", () => {
  it("drops the declaration and comments, sorts attributes, writes empty elements in full", () => {
    expect(c14n('<?xml version="1.0"?>\r\n<a  z="1" b=\'2\' >x &gt; y &amp; z<e/><!-- c --></a>')).toBe(
      '<a b="2" z="1">x &gt; y &amp; z<e></e></a>',
    );
  });

  it("normalizes literal whitespace in attributes and escapes referenced tab, newline, quote and <", () => {
    expect(c14n('<a t="l1\nl2" u="&#xA;&#9;&quot;&lt;"/>')).toBe('<a t="l1 l2" u="&#xA;&#x9;&quot;&lt;"></a>');
  });

  it("keeps text whitespace exactly, CRLF read as LF, a CR reference escaped, CDATA as text", () => {
    expect(c14n("<a>\r\n  <b>1</b>\r\n</a>")).toBe("<a>\n  <b>1</b>\n</a>");
    expect(c14n("<a><![CDATA[<b>&]]>&#xD;</a>")).toBe("<a>&lt;b&gt;&amp;&#xD;</a>");
  });

  it("writes namespaces where they first apply, unqualified attributes first", () => {
    expect(c14n('<r xmlns="urn:a" xmlns:p="urn:p"><p:c p:z="1" y="2" xmlns:p="urn:p"/><d xmlns=""/></r>')).toBe(
      '<r xmlns="urn:a" xmlns:p="urn:p"><p:c y="2" p:z="1"></p:c><d xmlns=""></d></r>',
    );
  });

  it("gives a subtree the namespaces it inherits, as a signature's SignedInfo", () => {
    const root = parseXml('<doc><Signature xmlns="urn:dsig"><SignedInfo><M A="x"/></SignedInfo></Signature></doc>');
    const signature = root && firstChild(root);
    const signedInfo = signature && firstChild(signature);
    if (!root || !signature || !signedInfo) throw new Error("not parsed");
    const around = scopeOf(signature, scopeOf(root, new Map()));
    expect(canonicalize(signedInfo, { around })).toBe('<SignedInfo xmlns="urn:dsig"><M A="x"></M></SignedInfo>');
    expect(canonicalize(root, { omit: signature })).toBe("<doc></doc>");
  });
});

describe("XML reader", () => {
  it("refuses what an e-KYC file never holds", () => {
    for (const xml of [
      '<!DOCTYPE a [<!ENTITY x "y">]><a>&x;</a>',
      "<a>&x;</a>",
      "<a>&amp</a>",
      "<?pi data?><a/>",
      "<a><?pi data?></a>",
      '<a b="1" b="2"/>',
      "<a></b>",
      "<a>",
      "<a/><b/>",
      "<a b=1/>",
      '<a b="<"/>',
      `${"<a>".repeat(40)}${"</a>".repeat(40)}`,
    ])
      expect(parseXml(xml), xml).toBeUndefined();
  });
});
