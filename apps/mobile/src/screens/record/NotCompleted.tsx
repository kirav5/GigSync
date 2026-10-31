import type { JobRecord } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { type CardProps, JobFold } from "../activity/JobLists.js";

/** Records' small fold at the end: jobs cancelled, declined or left to expire, each opening to its own card. */
export function NotCompleted({ jobs, ...card }: CardProps & { jobs: readonly JobRecord[] }) {
  const { t } = useI18n();
  return <JobFold summary={t("page.not_completed", { count: jobs.length })} jobs={jobs} {...card} />;
}
