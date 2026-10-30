import {
  ConsentState,
  type EngagementId,
  type JobRecordSubmit,
  type JobStatusChange,
  JobSubmitResult,
  MyBoardProfile,
  MyJobRecords,
  type PaymentReport,
  RECORDS_NOTICE_VERSION,
  RecordsDeleted,
  type RecordsPageInput,
  type StarsReport,
} from "@gigsync/protocol";
import { HttpMethod } from "../http.js";
import { ApiClient, ApiPath, HttpError } from "../net/api.js";
import type { RecordsApi } from "./types.js";

/** The routes of workers/api for job records (ADR 0038). */
export const RecordsPath = {
  consent: "/v1/consent",
  jobs: "/v1/jobs/records",
  status: "/status",
  payments: "/payments",
  stars: "/stars",
  mine: "/v1/jobs/records/mine",
  myRecords: "/v1/me/records",
} as const;

const SLASH = "/";
const NOT_FOUND = 404;

/** The same call, with "not there" as undefined instead of an error. */
async function orMissing<T>(call: () => Promise<T>): Promise<T | undefined> {
  try {
    return await call();
  } catch (err) {
    if (err instanceof HttpError && err.status === NOT_FOUND) return undefined;
    throw err;
  }
}

/** ApiClient with the job record calls: what a phone sends about its jobs, the consent, the export and deletion. */
export class RecordsClient extends ApiClient implements RecordsApi {
  private job(engagement: EngagementId, leaf: string): string {
    return `${RecordsPath.jobs}${SLASH}${engagement}${leaf}`;
  }

  async submitJob(submit: JobRecordSubmit): Promise<JobSubmitResult> {
    return JobSubmitResult.parse(await this.call(HttpMethod.post, RecordsPath.jobs, submit));
  }

  async reportStatus(engagement: EngagementId, change: JobStatusChange): Promise<void> {
    await this.call(HttpMethod.post, this.job(engagement, RecordsPath.status), change);
  }

  async reportPayment(engagement: EngagementId, report: PaymentReport): Promise<void> {
    await this.call(HttpMethod.post, this.job(engagement, RecordsPath.payments), report);
  }

  async reportStars(engagement: EngagementId, report: StarsReport): Promise<void> {
    await this.call(HttpMethod.put, this.job(engagement, RecordsPath.stars), report);
  }

  consent(): Promise<ConsentState | undefined> {
    return orMissing(async () => ConsentState.parse(await this.call(HttpMethod.get, RecordsPath.consent)));
  }

  async acceptConsent(): Promise<ConsentState> {
    const body = { notice_version: RECORDS_NOTICE_VERSION };
    return ConsentState.parse(await this.call(HttpMethod.put, RecordsPath.consent, body));
  }

  async deleteRecords(): Promise<RecordsDeleted> {
    return RecordsDeleted.parse(await this.call(HttpMethod.delete, RecordsPath.myRecords));
  }

  async myJobRecords(page: RecordsPageInput = {}): Promise<MyJobRecords> {
    const query = new URLSearchParams(
      Object.entries(page)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    );
    return MyJobRecords.parse(await this.call(HttpMethod.get, `${RecordsPath.mine}?${query}`));
  }

  ownCard(): Promise<MyBoardProfile | undefined> {
    return orMissing(async () => MyBoardProfile.parse(await this.call(HttpMethod.get, ApiPath.boardProfile)));
  }
}
