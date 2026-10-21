import { z } from "zod";

/** A phone number in E.164 form. The server only ever keeps its HMAC, never the number. */
export const Phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "E.164");

export const OtpRequest = z.object({ phone: Phone });

/** The public keys a device registers at sign-in, so other agents can verify it and seal envelopes to it. */
export const DeviceRegistration = z.object({
  signing_key: z.string().min(1).max(200),
  encryption_key: z.string().min(1).max(200),
  protocol: z.number().int().positive(),
  push_token: z.string().max(4096).optional(),
});

export const OtpVerify = z.object({
  phone: Phone,
  code: z.string().length(6),
  device: DeviceRegistration,
});

export type Phone = z.infer<typeof Phone>;
export type OtpRequest = z.infer<typeof OtpRequest>;
export type DeviceRegistration = z.infer<typeof DeviceRegistration>;
export type OtpVerify = z.infer<typeof OtpVerify>;
