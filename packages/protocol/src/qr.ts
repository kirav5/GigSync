import { z } from "zod";
import { BoardProfile } from "./board.js";
import { UserId } from "./ids.js";

/**
 * Personal QR codes (ADR 0034): every worker and household can show a QR that finds them. The QR is a link carrying a
 * short code, `<app>/?to=<code>`; the server maps the code to its owner and the owner can replace it at any time, which
 * ends the old one. A user id is never printed. A scanned worker shows their board card; a scanned household shows only
 * its first name, and a worker may offer to work for it (`work_offer`), which the household answers by asking.
 */

/** The device capability number that understands `work_offer`. Includes TERMS_PROTOCOL (5) and everything before it. */
export const WORK_OFFER_PROTOCOL = 6;

/** The query parameter of a QR link that carries the code. */
export const QR_PARAM = "to";
/** A code is 9 random bytes, base64url without padding: 72 bits, never guessed at the capped lookup rate. */
export const QR_CODE_BYTES = 9;
export const QrCode = z.string().regex(/^[A-Za-z0-9_-]{12}$/, "qr code");
export type QrCode = z.infer<typeof QrCode>;

/** Who a QR belongs to: a worker (their card shows) or a household (its first name shows). */
export const QrRole = z.enum(["worker", "household"]);
export type QrRole = z.infer<typeof QrRole>;

/** The longest first name a QR shows. */
export const QR_NAME_MAX = 40;
const firstName = z.string().trim().min(1).max(QR_NAME_MAX);

/** `PUT /v1/qr/me` and `POST /v1/qr/me/replace`: what the owner's QR shows besides a worker's card. */
export const MyQrRequest = z.object({ role: QrRole, first_name: firstName });
export type MyQrRequest = z.infer<typeof MyQrRequest>;

/** The owner's live code. */
export const MyQr = z.object({ code: QrCode, created_at: z.iso.datetime({ offset: true }) });
export type MyQr = z.infer<typeof MyQr>;

/**
 * `GET /v1/qr/:code`: who a live code belongs to, as a signed-in scanner sees them. A worker's card is their board
 * card (null while they have none on the board); a household shows its first name and nothing else.
 */
export const QrPerson = z.discriminatedUnion("role", [
  z.object({ role: z.literal(QrRole.enum.worker), user: UserId, first_name: firstName, card: BoardProfile.nullable() }),
  z.object({ role: z.literal(QrRole.enum.household), user: UserId, first_name: firstName }),
]);
export type QrPerson = z.infer<typeof QrPerson>;

/** `work_offer`: a worker → a household whose QR they scanned, with the card the household would ask them from. */
export const WorkOffer = z.object({ card: BoardProfile });
export type WorkOffer = z.infer<typeof WorkOffer>;

/** Codes one signed-in person may look up in an hour, found or not: enough to scan a street, too few to guess. */
export const QR_LOOKUPS_PER_HOUR = 30;
/** Offers to work one worker may send in a day. */
export const OFFERS_PER_WORKER_DAY = 10;
/** Offers to work one household may receive in a day. */
export const OFFERS_PER_HOUSEHOLD_DAY = 20;

/** Why `POST /v1/qr/:code/offer` refused an offer to work, as its `{ error }`: the phone tells its owner which. */
export const OfferRefusal = z.enum([
  /** This worker offered through this code in the last day already. */
  "offered_today",
  /** This worker sent OFFERS_PER_WORKER_DAY offers in the last day. */
  "worker_limit",
  /** This household received OFFERS_PER_HOUSEHOLD_DAY offers in the last day. */
  "household_limit",
  /** The offering worker has no card on the board to offer with. */
  "no_card",
  /** The code is the caller's own, or a worker's: offers go to households. */
  "not_household",
]);
export type OfferRefusal = z.infer<typeof OfferRefusal>;
