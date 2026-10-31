import { JobRecordStatus, Role } from "@gigsync/protocol";

/** The two sides of a job as the server names them; `reported_by` on job_payments holds the same values. */
export const Side = { worker: "worker", household: "household" } as const;
export type Side = (typeof Side)[keyof typeof Side];

/** The status a stored job no longer counts in. */
export const CANCELLED = JobRecordStatus.enum.cancelled;
export const AGREED = JobRecordStatus.enum.agreed;
export const DONE = JobRecordStatus.enum.done;

/** The worker is the provider; the household is the requester. */
export const sideOf = (role: Role): Side => (role === Role.enum.provider ? Side.worker : Side.household);
export const roleOf = (side: Side): Role => (side === Side.worker ? Role.enum.provider : Role.enum.requester);
