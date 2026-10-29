import { z } from "zod";
import { UserId } from "./ids.js";
import { Lang } from "./lang.js";
import { Trade } from "./trade.js";

/** A colleague code lives this long on the phone that shows it (ten minutes). */
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
/** The device capability number that understands `colleague`, `colleague_note` and `referral` envelopes. */
export const COLLEAGUE_PROTOCOL = 2;
/** At most this many trades or languages travel on a colleague card. */
const MAX_CARD_ITEMS = 5;

const shortText = z.string().min(1).max(300);
/** The code a colleague QR carries: 16 random bytes, base64url without padding. */
export const LinkCode = z.string().regex(/^[A-Za-z0-9_-]{22}$/, "link code");
export type LinkCode = z.infer<typeof LinkCode>;

/** What two linked colleagues know about each other: a name, what they do and the languages they speak. */
export const ColleagueCard = z.object({
  name: z.string().min(1).max(80),
  trades: z.array(Trade).max(MAX_CARD_ITEMS),
  languages: z.array(Lang).max(MAX_CARD_ITEMS),
});
export type ColleagueCard = z.infer<typeof ColleagueCard>;

/** The three steps of a link: the scanner asks (with the code it scanned), the shower answers ok, either side ends it. */
export const LinkStep = z.enum(["ask", "ok", "end"]);
export type LinkStep = z.infer<typeof LinkStep>;

/** `colleague`: one step of linking two colleagues met in person, or ending the link. */
export const ColleagueLink = z
  .object({ step: LinkStep, code: LinkCode.optional(), card: ColleagueCard.optional() })
  .refine(
    (b) => b.step !== LinkStep.enum.ask || (b.code !== undefined && b.card !== undefined),
    "ask needs code and card",
  )
  .refine((b) => b.step !== LinkStep.enum.ok || b.card !== undefined, "ok needs a card");
export type ColleagueLink = z.infer<typeof ColleagueLink>;

/** `colleague_note`: a message between linked colleagues, tagged with the language it is in. */
export const ColleagueNote = z.object({ text: shortText, lang: Lang });
export type ColleagueNote = z.infer<typeof ColleagueNote>;

/** `referral`: worker → household, on a request the worker declined: a colleague the household may ask instead. */
export const Referral = z.object({ colleague: UserId, card: ColleagueCard, note: shortText.optional() });
export type Referral = z.infer<typeof Referral>;

/** The colleague QR: who shows it, the one-time code, and the name the scanner sees before anything is sent. */
export const INVITE_PREFIX = "gigsync:colleague?";
export const LinkInvite = z.object({ u: UserId, c: LinkCode, n: z.string().min(1).max(80) });
export type LinkInvite = z.infer<typeof LinkInvite>;

/** The QR text for an invite. */
export function inviteText(invite: LinkInvite): string {
  return `${INVITE_PREFIX}${new URLSearchParams(invite).toString()}`;
}

/** An invite from scanned text, or undefined when it is not a GigSync colleague code. */
export function parseInvite(text: string): LinkInvite | undefined {
  if (!text.startsWith(INVITE_PREFIX)) return undefined;
  const params = new URLSearchParams(text.slice(INVITE_PREFIX.length));
  return LinkInvite.safeParse({ u: params.get("u"), c: params.get("c"), n: params.get("n") }).data;
}
