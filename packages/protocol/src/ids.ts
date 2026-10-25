import { z } from "zod";

/** Crockford base32, 26 chars: a ULID. Sortable by time, unique without coordination. */
export const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Every ID is `<prefix>_<ulid>` so a bare ID says what it names. */
export const prefixedId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`), `${prefix}_<ULID>`);

export const UserId = prefixedId("usr");
export const DeviceId = prefixedId("dev");
export const MessageId = prefixedId("msg");
export const EngagementId = prefixedId("eng");
export const ChainId = prefixedId("chn");
export const GrantId = prefixedId("grt");
export const PaymentId = prefixedId("pay");

export type UserId = z.infer<typeof UserId>;
export type DeviceId = z.infer<typeof DeviceId>;
export type MessageId = z.infer<typeof MessageId>;
export type EngagementId = z.infer<typeof EngagementId>;
export type ChainId = z.infer<typeof ChainId>;
export type GrantId = z.infer<typeof GrantId>;
export type PaymentId = z.infer<typeof PaymentId>;
