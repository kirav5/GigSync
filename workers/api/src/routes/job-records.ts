import { log } from "@gigsync/core/log";
import {
  EngagementId,
  HOURS_PROTOCOL,
  JobRecordSubmit,
  JobStatusChange,
  RECORD_SUBMISSIONS_PER_HOUR,
  RecordRefusal,
  RecordsPage,
} from "@gigsync/protocol";
import { Hono } from "hono";
import { ApiError, type AppEnv, ENGAGEMENT_PARAM, Var } from "../context.js";
import { deviceProtocol } from "../db/devices.js";
import { paymentsFor } from "../db/job-payments.js";
import { partyOf, recordsPage, setStatus } from "../db/job-records.js";
import { countHit, RateAction } from "../db/rate-windows.js";
import { recordFallbackCity } from "../live-cities.js";
import { requireConsent } from "../middleware/consent.js";
import { attest } from "../records/attest.js";
import { exportPage } from "../records/export.js";
import { StatusMove, statusMove } from "../records/rules.js";

/**
 * Job records (ADR 0038), behind the session middleware: each side submits the job it signed; either side marks it
 * done or cancelled; a person exports their own records. Writes need the current notice accepted.
 */
export const jobRecords = new Hono<AppEnv>();

const Path = { submit: "/", mine: "/mine", status: `/:${ENGAGEMENT_PARAM}/status` } as const;

const HOUR_MS = 3600_000;
const body = async (req: Request) => req.json().catch(() => null);

jobRecords.post(Path.submit, requireConsent, async (c) => {
  const submit = JobRecordSubmit.safeParse(await body(c.req.raw));
  const user = c.get(Var.user);
  if (!submit.success || submit.data.counterpart === user) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const now = new Date();
  const hits = await countHit(db, user, RateAction.jobSubmit, now, new Date(now.getTime() - HOUR_MS));
  if (hits > RECORD_SUBMISSIONS_PER_HOUR) return c.json({ error: ApiError.tooManyAttempts }, 429);
  const out = await attest(db, user, submit.data, now, recordFallbackCity(c.env));
  const requestId = c.get(Var.requestId);
  if ("unknownCounterpart" in out) return c.json({ error: ApiError.recipientNotFound }, 404);
  if ("refusal" in out) {
    log.warn("job record refused", { requestId, user, refusal: out.refusal });
    const status = out.refusal === RecordRefusal.enum.bad_signature ? 400 : 409;
    return c.json({ error: out.refusal }, status);
  }
  log.info("job record submitted", { requestId, user, engagement: submit.data.engagement, state: out.state });
  return c.json(out);
});

jobRecords.post(Path.status, requireConsent, async (c) => {
  const engagement = EngagementId.safeParse(c.req.param(ENGAGEMENT_PARAM));
  const change = JobStatusChange.safeParse(await body(c.req.raw));
  if (!engagement.success || !change.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const party = await partyOf(db, engagement.data, c.get(Var.user));
  if (!party) return c.json({ error: ApiError.notFound }, 404);
  const move = statusMove(party.status, change.data.status);
  if (move === StatusMove.refuse) return c.json({ error: RecordRefusal.enum.wrong_status }, 409);
  if (move === StatusMove.change) await setStatus(db, engagement.data, change.data.status, new Date());
  log.info("job record status", { requestId: c.get(Var.requestId), engagement: engagement.data, move });
  return c.json({ status: change.data.status });
});

/** "My work record": the caller's own stored jobs, a page at a time. No consent needed to take what is yours. */
jobRecords.get(Path.mine, async (c) => {
  const page = RecordsPage.safeParse(c.req.query());
  if (!page.success) return c.json({ error: ApiError.badRequest }, 400);
  const db = c.get(Var.db);
  const user = c.get(Var.user);
  const rows = await recordsPage(db, user, page.data);
  const payments = await paymentsFor(
    db,
    rows.slice(0, page.data.limit).map((r) => r.engagement_id),
  );
  const hours = (await deviceProtocol(db, c.get(Var.device), user)) >= HOURS_PROTOCOL;
  const out = exportPage(rows, page.data.limit, user, payments, hours);
  log.info("job records exported", { requestId: c.get(Var.requestId), user, jobs: out.jobs.length });
  return c.json(out);
});
