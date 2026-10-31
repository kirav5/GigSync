import { log } from "@gigsync/core/log";
import {
  TRANSFER_MAX_CHARS,
  TRANSFER_TTL_MS,
  TRANSFERS_PER_HOUR,
  type TransferDownload,
  TransferId,
  TransferUpload,
} from "@gigsync/protocol";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ulid } from "ulid";
import { ApiError, type AppEnv, SLOT_PARAM, Var } from "../context.js";
import { countHit, RateAction } from "../db/rate-windows.js";
import { purgeExpired, putSlot, takeSlot } from "../db/transfer.js";

/**
 * Moving to a new phone (ADR 0037 §3), behind the session middleware. The old phone uploads its owner's data,
 * encrypted with a key the server never sees; the new phone, signed in as the same user, downloads it once. Expired
 * slots are purged on every create and download, so nothing outlives TRANSFER_TTL_MS by more than the next use.
 */
export const transfer = new Hono<AppEnv>();

const Path = { create: "/", slot: `/:${SLOT_PARAM}` } as const;

/** Room for the JSON around the ciphertext (`{"ciphertext":"…"}` and whitespace), in bytes. */
const JSON_OVERHEAD_BYTES = 1024;
const HOUR_MS = 3600_000;
const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** Refuses an oversized body before reading it (Content-Length or while streaming), not after parsing. */
const uploadLimit = bodyLimit({
  maxSize: TRANSFER_MAX_CHARS + JSON_OVERHEAD_BYTES,
  onError: (c) => c.json({ error: ApiError.tooLarge }, 413),
});

transfer.post(Path.create, uploadLimit, async (c) => {
  const upload = TransferUpload.safeParse(await c.req.json().catch(() => null));
  if (!upload.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const now = new Date();
  if ((await countHit(db, user, RateAction.transfer, now, ago(now, HOUR_MS))) > TRANSFERS_PER_HOUR)
    return c.json({ error: ApiError.tooManyAttempts }, 429);
  const purged = await purgeExpired(db, now);
  const slot = await putSlot(db, {
    id: `xfr_${ulid()}` as TransferId,
    user,
    device: c.get(Var.device),
    ciphertext: upload.data.ciphertext,
    at: now,
    expiresAt: new Date(now.getTime() + TRANSFER_TTL_MS),
  });
  log.info("transfer slot created", {
    requestId: c.get(Var.requestId),
    user,
    chars: upload.data.ciphertext.length,
    purged,
  });
  return c.json(slot, 201);
});

transfer.get(Path.slot, async (c) => {
  const id = TransferId.safeParse(c.req.param(SLOT_PARAM));
  if (!id.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const now = new Date();
  const taken = await takeSlot(db, id.data, user);
  const purged = await purgeExpired(db, now);
  const requestId = c.get(Var.requestId);
  // Someone else's slot answers as a missing one: a slot id says nothing about who made it.
  if (!taken) return c.json({ error: ApiError.notFound }, 404);
  if (taken.expires_at <= now) {
    log.info("transfer slot expired", { requestId, user, purged });
    return c.json({ error: ApiError.expired }, 410);
  }
  log.info("transfer slot downloaded", { requestId, user, from: taken.device_id, purged });
  return c.json({ ciphertext: taken.ciphertext, device: taken.device_id } satisfies TransferDownload);
});
