import { z } from "zod";
import { PhoneConfirm } from "./auth.js";
import { UserId } from "./ids.js";

/**
 * `POST /v1/auth/connector`: a connected assistant (ADR 0068) signs in for an owner who already uses GigSync, by the
 * dev code or a Firebase ID token for the number, as a phone confirms a second number. It registers no device.
 */
export const ConnectorSignIn = PhoneConfirm;

/** What `POST /v1/auth/connector` returns: whose it is and the bearer token for `/v1/connector/*`. */
export const ConnectorSession = z.object({ user: UserId, token: z.string().min(1) });

export type ConnectorSignIn = z.infer<typeof ConnectorSignIn>;
export type ConnectorSession = z.infer<typeof ConnectorSession>;
