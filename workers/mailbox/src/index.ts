import { DurableObject } from "cloudflare:workers";
import { HttpMethod } from "@gigsync/core/http";
import { configureLog, log, pii } from "@gigsync/core/log";
import { DEFAULT_TTL_SECONDS, type DeviceId, Envelope, type MessageId } from "@gigsync/protocol";

export interface Env {
  MAILBOX: DurableObjectNamespace<Mailbox>;
  /** Shared with workers/api, which hosts this class; see packages/core/src/log.ts. */
  ENVIRONMENT?: string;
  LOG_LEVEL?: string;
  LOG_PII?: string;
}

interface DeliverBody {
  envelope: Envelope;
  /** The recipient's active devices at the time of delivery, from the directory. */
  devices: DeviceId[];
}

type Row = {
  msg_id: MessageId;
  device_id: DeviceId;
  body: string;
  expires_at: number;
};

/**
 * The post office box for one user. Stores each sealed envelope once per active device, hands them out on fetch,
 * deletes a device's copy on ack, and expires what nobody collected. It never opens an envelope; it only reads the
 * routing header. State lives in the object's own SQLite, so a million users are a million small boxes, not one
 * hot table.
 */
export class Mailbox extends DurableObject<Env> {
  private sql = this.ctx.storage.sql;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    configureLog(env);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS envelopes (
        msg_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        body TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (msg_id, device_id)
      );
      CREATE INDEX IF NOT EXISTS envelopes_device ON envelopes (device_id, msg_id);
      CREATE INDEX IF NOT EXISTS envelopes_expiry ON envelopes (expires_at);
      CREATE TABLE IF NOT EXISTS seen (msg_id TEXT PRIMARY KEY, at INTEGER NOT NULL);
    `);
  }

  /** Stores one envelope for every device. Idempotent on envelope id. Returns whether it was new. */
  async deliver(body: DeliverBody): Promise<{ stored: boolean; devices: number }> {
    const e = Envelope.parse(body.envelope);
    const now = Math.floor(Date.now() / 1000);
    const expires = Math.min(
      Math.floor(Date.parse(e.expires_at) / 1000),
      now + DEFAULT_TTL_SECONDS.job, // never trust a sender to keep a box alive for months
    );
    if (expires <= now) {
      log.info("mailbox: envelope already expired", { messageId: e.id });
      return { stored: false, devices: 0 };
    }

    const seen = this.sql.exec("SELECT 1 FROM seen WHERE msg_id = ?", e.id).toArray();
    if (seen.length > 0) {
      log.info("mailbox: duplicate envelope", { messageId: e.id });
      return { stored: false, devices: 0 };
    }

    const text = JSON.stringify(e);
    for (const d of body.devices) {
      this.sql.exec(
        "INSERT OR IGNORE INTO envelopes (msg_id, device_id, body, expires_at) VALUES (?, ?, ?, ?)",
        e.id,
        d,
        text,
        expires,
      );
    }
    this.sql.exec("INSERT INTO seen (msg_id, at) VALUES (?, ?)", e.id, now);
    await this.scheduleExpiry();
    log.debug("mailbox: stored", { messageId: e.id, devices: body.devices, expires, envelope: pii(e) });
    return { stored: true, devices: body.devices.length };
  }

  /** Everything waiting for one device, oldest first (ULIDs sort by time). */
  async fetchFor(device: DeviceId, limit = 100): Promise<Envelope[]> {
    const now = Math.floor(Date.now() / 1000);
    const rows = this.sql
      .exec<Row>(
        "SELECT msg_id, device_id, body, expires_at FROM envelopes WHERE device_id = ? AND expires_at > ? ORDER BY msg_id LIMIT ?",
        device,
        now,
        limit,
      )
      .toArray();
    log.debug("mailbox: fetch", { device, count: rows.length });
    return rows.map((r) => JSON.parse(r.body) as Envelope);
  }

  /** The device has the envelopes; drop its copies. */
  async ack(device: DeviceId, ids: MessageId[]): Promise<number> {
    let n = 0;
    for (const id of ids) {
      n += this.sql.exec("DELETE FROM envelopes WHERE device_id = ? AND msg_id = ?", device, id).rowsWritten;
    }
    log.debug("mailbox: ack", { device, requested: ids.length, deleted: n });
    return n;
  }

  async pending(): Promise<number> {
    return Number(this.sql.exec("SELECT COUNT(*) AS n FROM envelopes").one().n);
  }

  /** Expiry runs on the object's own alarm, so there is no global sweep over every user. */
  async alarm() {
    const now = Math.floor(Date.now() / 1000);
    const expired = this.sql.exec("DELETE FROM envelopes WHERE expires_at <= ?", now).rowsWritten;
    if (expired > 0) log.info("mailbox: expired envelopes", { count: expired });
    // Remember ids for seven days after expiry so a late retry cannot resurrect a message.
    this.sql.exec("DELETE FROM seen WHERE at <= ?", now - DEFAULT_TTL_SECONDS.job);
    await this.scheduleExpiry();
  }

  private async scheduleExpiry() {
    const next = this.sql.exec<{ t: number | null }>("SELECT MIN(expires_at) AS t FROM envelopes").one().t;
    if (next === null) return;
    const current = await this.ctx.storage.getAlarm();
    if (current === null || current > next * 1000) await this.ctx.storage.setAlarm(next * 1000);
  }
}

/** Actions of the local test surface: /mailbox/:user/:action. */
const Action = { deliver: "deliver", fetch: "fetch", ack: "ack" } as const;
const DEVICE_PARAM = "device";
const NOT_FOUND = "not found";

/** Minimal HTTP surface for local testing. The API Worker calls the object's methods directly via RPC. */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const [, , user, action] = url.pathname.split("/"); // /mailbox/:user/:action
    if (!user) return new Response(NOT_FOUND, { status: 404 });
    const box = env.MAILBOX.get(env.MAILBOX.idFromName(user));
    if (req.method === HttpMethod.post && action === Action.deliver)
      return Response.json(await box.deliver(await req.json()));
    if (req.method === HttpMethod.get && action === Action.fetch) {
      const device = url.searchParams.get(DEVICE_PARAM) as DeviceId | null;
      if (!device) return new Response("device required", { status: 400 });
      return Response.json(await box.fetchFor(device));
    }
    if (req.method === HttpMethod.post && action === Action.ack) {
      const { device, ids } = (await req.json()) as { device: DeviceId; ids: MessageId[] };
      return Response.json({ acked: await box.ack(device, ids) });
    }
    return new Response(NOT_FOUND, { status: 404 });
  },
};
