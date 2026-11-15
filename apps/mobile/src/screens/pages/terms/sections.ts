import type { MessageKey } from "@gigsync/core";
import { TEXT_ONE } from "./textOne.js";
import { TEXT_TWO } from "./textTwo.js";

/**
 * The Terms of Use and the Privacy Notice in short, as data: each section's title and summary are catalog lines in
 * every language (core i18n, `legal.*`), its full text English only, here. Written for how the app works (no
 * commission, payment straight between the two people, an agent on each phone, private details kept on the phone)
 * and with no company or brand name. A draft: a lawyer checks it before launch, and the bracketed parts are still to
 * be filled.
 */

/** When the text below last changed: shown at the top of the page, in the reader's own date format. */
export const TERMS_UPDATED = "2026-11-16";

/** A bullet: its text, or a short bold lead and the text after it. */
export type TermsItem = string | readonly [lead: string, text: string];
/** A paragraph, or a list of bullets. */
export type TermsBlock = string | readonly TermsItem[];

export const SECTION_IDS = [
  "about",
  "service",
  "account",
  "agent",
  "jobs",
  "cancel",
  "conduct",
  "privacy",
  "deletion",
  "rules",
  "content",
  "liability",
  "law",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];
/** The full text of some of the sections. */
export type SectionText<K extends SectionId> = Readonly<Record<K, readonly TermsBlock[]>>;

export interface TermsSection {
  id: SectionId;
  /** Its number in the contents and over its heading, from 1. */
  number: number;
  title: MessageKey;
  summary: MessageKey;
  /** The full text, in English. */
  body: readonly TermsBlock[];
}

const TEXT: SectionText<SectionId> = { ...TEXT_ONE, ...TEXT_TWO };

export const TERMS_SECTIONS: readonly TermsSection[] = SECTION_IDS.map((id, i) => ({
  id,
  number: i + 1,
  title: `legal.${id}`,
  summary: `legal.${id}.sum`,
  body: TEXT[id],
}));
