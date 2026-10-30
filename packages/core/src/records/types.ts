import type {
  ConsentState,
  EngagementId,
  JobRecordSubmit,
  JobStatusChange,
  JobSubmitResult,
  MyBoardProfile,
  MyJobRecords,
  PaymentReport,
  RecordsDeleted,
  RecordsPageInput,
  StarsReport,
} from "@gigsync/protocol";

/** The server's job record routes (ADR 0038). RecordsClient implements them; tests use a fake. */
export interface RecordsApi {
  submitJob(submit: JobRecordSubmit): Promise<JobSubmitResult>;
  reportStatus(engagement: EngagementId, change: JobStatusChange): Promise<void>;
  reportPayment(engagement: EngagementId, report: PaymentReport): Promise<void>;
  reportStars(engagement: EngagementId, report: StarsReport): Promise<void>;
  /** What the owner accepted; undefined when they never did (or deleted their records since). */
  consent(): Promise<ConsentState | undefined>;
  acceptConsent(): Promise<ConsentState>;
  deleteRecords(): Promise<RecordsDeleted>;
  myJobRecords(page?: RecordsPageInput): Promise<MyJobRecords>;
  /** The owner's own card with their record and switch; undefined when they have no card on the board. */
  ownCard(): Promise<MyBoardProfile | undefined>;
}
