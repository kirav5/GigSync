import { z } from "zod";
import { DeviceId, UserId } from "./ids.js";

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

/** `PUT /v1/devices/me/protocol`: a signed-in device says it now speaks a newer protocol, after an app update. */
export const DeviceProtocol = DeviceRegistration.pick({ protocol: true });

export const OtpVerify = z.object({
  phone: Phone,
  code: z.string().length(6),
  device: DeviceRegistration,
});

/** What `POST /v1/auth/otp/verify` returns: who signed in, on which device, and the bearer token for later calls. */
export const Session = z.object({ user: UserId, device: DeviceId, token: z.string().min(1) });

/** One registered device as the directory lists it: enough to seal to it and check its signatures. */
export const DeviceKeys = z.object({
  device_id: DeviceId,
  signing_key: z.string().min(1),
  encryption_key: z.string().min(1),
  protocol: z.number().int().positive(),
});

/** `GET /v1/directory/:user`: a person's active devices. */
export const DirectoryEntry = z.object({ user: UserId, devices: z.array(DeviceKeys) });

export type Phone = z.infer<typeof Phone>;
export type DeviceProtocol = z.infer<typeof DeviceProtocol>;
export type Session = z.infer<typeof Session>;
export type DeviceKeys = z.infer<typeof DeviceKeys>;
export type DirectoryEntry = z.infer<typeof DirectoryEntry>;
export type OtpRequest = z.infer<typeof OtpRequest>;
export type DeviceRegistration = z.infer<typeof DeviceRegistration>;
export type OtpVerify = z.infer<typeof OtpVerify>;
