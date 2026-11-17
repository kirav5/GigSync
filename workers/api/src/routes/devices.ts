import { log } from "@gigsync/core/log";
import { DeviceId, DeviceProtocol, PushAddress, type PushKey } from "@gigsync/protocol";
import { Hono } from "hono";
import { sessionCache } from "../auth/session-cache.js";
import { ApiError, type AppEnv, DEVICE_PARAM, Var } from "../context.js";
import { transaction } from "../db/client.js";
import { raiseProtocol, revokeDevice, setPushAddress } from "../db/devices.js";
import { fcmOf } from "../push/fcm.js";
import { vapidOf } from "../push/webpush.js";

/** The caller's own devices, behind the session middleware. */
export const devices = new Hono<AppEnv>();

const Path = {
  protocol: "/me/protocol",
  push: "/me/push",
  pushKey: "/push-key",
  device: `/:${DEVICE_PARAM}`,
} as const;

/**
 * The public VAPID key the browser subscribes with; none until both halves are set (a subscription the API could not
 * push to would only promise alerts that never come), and the app then says alerts are not switched on yet. With the
 * Firebase service account set, `native` says the Android app's alerts can go too (ADR 0067).
 */
devices.get(Path.pushKey, (c) => {
  const vapid = vapidOf(c.env);
  const key: PushKey = { ...(vapid ? { public_key: vapid.publicKey } : {}), ...(fcmOf(c.env) ? { native: true } : {}) };
  return c.json(key);
});

/**
 * Where this device takes pushes: its browser's address and keys, on one of the big push services only, or the Android
 * app's FCM token and language (PushAddress). The app sends it each time it opens with notifications on, so an
 * address the service changed is replaced; DELETE turns them off.
 */
devices.put(Path.push, async (c) => {
  const body = PushAddress.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const found = await setPushAddress(c.get(Var.db), c.get(Var.device), c.get(Var.user), body.data);
  if (!found) return c.json({ error: ApiError.notFound }, 404);
  log.info("push subscribed", { requestId: c.get(Var.requestId) });
  return c.body(null, 204);
});

devices.delete(Path.push, async (c) => {
  await setPushAddress(c.get(Var.db), c.get(Var.device), c.get(Var.user), null);
  log.info("push unsubscribed", { requestId: c.get(Var.requestId) });
  return c.body(null, 204);
});

/**
 * A device registers its protocol only at sign-in, so a phone updated since would stay on the old number and never
 * be sent newer kinds. The app calls this once after an update; the number only goes up.
 */
devices.put(Path.protocol, async (c) => {
  const body = DeviceProtocol.safeParse(await c.req.json().catch(() => undefined));
  if (!body.success) return c.json({ error: ApiError.badRequest }, 400);
  const found = await raiseProtocol(c.get(Var.db), c.get(Var.device), c.get(Var.user), body.data.protocol);
  if (!found) return c.json({ error: ApiError.notFound }, 404);
  log.info("device protocol raised", { requestId: c.get(Var.requestId), protocol: body.data.protocol });
  return c.body(null, 204);
});

/**
 * Revokes another of the caller's devices and its sessions: the new phone does this to the old one once a transfer
 * (ADR 0037 §3) has decrypted. Not the calling device: signing out is the app's own business. Another user's device
 * answers as a missing one.
 */
devices.delete(Path.device, async (c) => {
  const device = DeviceId.safeParse(c.req.param(DEVICE_PARAM));
  if (!device.success) return c.json({ error: ApiError.badRequest }, 400);
  if (device.data === c.get(Var.device)) return c.json({ error: ApiError.callingDevice }, 409);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const now = new Date();
  const revoked = await transaction(db, () => revokeDevice(db, user, device.data, now));
  if (!revoked) return c.json({ error: ApiError.notFound }, 404);
  sessionCache.forgetDevices([device.data], now.getTime());
  log.info("device revoked", { requestId: c.get(Var.requestId), user, device: device.data });
  return c.body(null, 204);
});
