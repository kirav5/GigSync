import {
  type ConsentState,
  type EngagementId,
  type JobRecordSubmit,
  type JobStatusChange,
  JobSubmitState,
  type MyBoardProfile,
  type MyJobRecords,
  type PaymentReport,
  RECORDS_NOTICE_VERSION,
  RecordRefusal,
  type RecordsDeleted,
  type RecordsPageInput,
  type StarsReport,
} from "@gigsync/protocol";
import { HttpError, type RecordsApi } from "../src/index.js";

/** One call the server took. */
export type Taken =
  | { kind: "job"; body: JobRecordSubmit }
  | { kind: "status"; engagement: EngagementId; body: JobStatusChange }
  | { kind: "payment"; engagement: EngagementId; body: PaymentReport }
  | { kind: "stars"; engagement: EngagementId; body: StarsReport };

/** GigSync's job record routes in memory, for one phone: what it took, and failures a test asks for. */
export class FakeRecords implements RecordsApi {
  readonly taken: Taken[] = [];
  consentState: ConsentState | undefined;
  /** Answer the next calls with this error instead of taking them. */
  failing: Error | undefined;
  /** Refuse only what a phone sends about its jobs with this error; the consent routes still answer. */
  refusing: Error | undefined;
  deleted = 0;
  card: MyBoardProfile | undefined;
  pages: MyJobRecords[] = [{ jobs: [] }];
  readonly asked: RecordsPageInput[] = [];

  private take(call: Taken): Promise<void> {
    const error = this.failing ?? this.refusing;
    if (error) return Promise.reject(error);
    this.taken.push(call);
    return Promise.resolve();
  }

  async submitJob(body: JobRecordSubmit) {
    await this.take({ kind: "job", body });
    return { state: JobSubmitState.enum.pending };
  }
  reportStatus(engagement: EngagementId, body: JobStatusChange) {
    return this.take({ kind: "status", engagement, body });
  }
  reportPayment(engagement: EngagementId, body: PaymentReport) {
    return this.take({ kind: "payment", engagement, body });
  }
  reportStars(engagement: EngagementId, body: StarsReport) {
    return this.take({ kind: "stars", engagement, body });
  }
  async consent() {
    if (this.failing) throw this.failing;
    return this.consentState;
  }
  async acceptConsent() {
    if (this.failing) throw this.failing;
    const accepted = { notice_version: RECORDS_NOTICE_VERSION, accepted_at: new Date().toISOString(), current: true };
    this.consentState = accepted;
    return accepted;
  }
  async deleteRecords(): Promise<RecordsDeleted> {
    this.deleted += 1;
    this.consentState = undefined;
    return { deleted: this.taken.length, anonymised: 0, submissions: 0 };
  }
  async myJobRecords(page: RecordsPageInput = {}) {
    this.asked.push(page);
    return this.pages[this.asked.length - 1] ?? { jobs: [] };
  }
  async ownCard() {
    if (this.failing) throw this.failing;
    return this.card;
  }

  kinds(): string[] {
    return this.taken.map((t) => t.kind);
  }
}

export const refused = () => new HttpError(409, RecordRefusal.enum.record_differs);
export const noConsent = () => new HttpError(403, RecordRefusal.enum.no_consent);
export const unavailable = () => new HttpError(503, "unavailable");
