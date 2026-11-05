import { type JobRecord, type NeedTo, NOT_COMPLETED } from "@gigsync/core";
import { CancelReason, EngagementStatus, Role } from "@gigsync/protocol";
import { needToOfJob } from "../../find/ask.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

const S = EngagementStatus.enum;
/** Reasons after which the same worker is not asked again: not their work or area, or the household hired another. */
const NOT_AGAIN: ReadonlySet<CancelReason> = new Set([CancelReason.enum.no_match, CancelReason.enum.taken]);
/** Work done: the same worker may be asked again, for the next time. */
const DONE: ReadonlySet<EngagementStatus> = new Set([S.delivered, S.revision, S.closed]);

/**
 * A household's closed job (ADR 0053 §5). One that ended without the work: ask the same worker again, or find someone
 * else. One done: ask them again. Each opens a new Find chat, which asks the time and the budget afresh; the old ones
 * are usually why a job ended.
 */
export function AskAgain({ job, them, onAgain }: { job: JobRecord; them: string; onAgain: (to?: NeedTo) => void }) {
  const { t } = useI18n();
  const status = job.engagement.status;
  const done = DONE.has(status);
  if (job.engagement.role !== Role.enum.requester || !(done || NOT_COMPLETED.has(status))) return null;
  if (job.cancel?.reason === CancelReason.enum.taken) return null;
  const again = done || !NOT_AGAIN.has(job.cancel?.reason ?? CancelReason.enum.other);
  return (
    <div className={C.actions}>
      {again && (
        <button type={C.button} className={C.accent} onClick={() => onAgain(needToOfJob(job, them))}>
          {t("job.ask_again", { name: them })}
        </button>
      )}
      {!done && (
        <button type={C.button} className={C.secondary} onClick={() => onAgain()}>
          {t("job.find_another")}
        </button>
      )}
    </div>
  );
}
