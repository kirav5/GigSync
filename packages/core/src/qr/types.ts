import type { BoardProfile, EngagementId, MyQr, MyQrRequest, QrCode, QrPerson, UserId } from "@gigsync/protocol";

/** workers/api's personal QR routes (ADR 0034). ApiClient implements them; tests fake them in memory. */
export interface QrApi {
  /** The caller's live code, made on first ask. */
  myQr(owner: MyQrRequest): Promise<MyQr>;
  /** A new code for the caller; the old one stops finding them. */
  replaceQr(owner: MyQrRequest): Promise<MyQr>;
  /** Who a live code belongs to. */
  lookupQr(code: QrCode): Promise<QrPerson>;
  /** Takes one offer to work through a household's live code; the work_offer envelope may follow. */
  takeOffer(code: QrCode): Promise<void>;
  /** One worker's card as the board serves it, record capped (ADR 0036); undefined when they are not on the board. */
  workerCard(user: UserId): Promise<BoardProfile | undefined>;
}

/** Where an offer to work stands on the household's phone. */
export const OfferState = { open: "open", asked: "asked", declined: "declined" } as const;
export type OfferState = (typeof OfferState)[keyof typeof OfferState];

/** An offer to work a household received: who, their card, and what the household did with it. */
export interface ReceivedOffer {
  /** The channel the offer came on: its record's id. */
  channel: EngagementId;
  worker: UserId;
  card: BoardProfile;
  state: OfferState;
  at: string;
}

/** An offer this worker sent, kept to count the day's offers and to show "offered" on the household's view. */
export interface SentOffer {
  channel: EngagementId;
  household: UserId;
  at: string;
}
