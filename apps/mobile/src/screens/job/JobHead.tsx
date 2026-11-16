import { dayOf, type JobRecord, WhenDetail } from "@gigsync/core";
import { EngagementStatus, type JobRequest, type Lang } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { Avatar, AvatarSize, AvatarTone } from "../../ui/Avatar.js";
import { C } from "../../ui/cls.js";
import { Said } from "../../ui/Said.js";
import { requestWork } from "../../ui/work.js";
import { dayWord } from "../JobProgress.js";
import { J } from "./look.js";

const S = EngagementStatus.enum;
const TALK = "tag talk";
const WAIT = "tag wait";
const FRESH = "tag fresh";
const DANGER = "tag danger";
const DOT = " · ";

/** How each status looks; its words come from the owner's language (`status.<name>`). */
const TAG: Readonly<Record<EngagementStatus, string>> = {
  [S.draft]: TALK,
  [S.sent]: TALK,
  [S.clarifying]: WAIT,
  [S.responded]: TALK,
  [S.negotiating]: TALK,
  [S.confirming]: WAIT,
  [S.agreed]: FRESH,
  [S.in_progress]: FRESH,
  [S.delivered]: FRESH,
  [S.revision]: WAIT,
  [S.closed]: FRESH,
  [S.declined]: DANGER,
  [S.expired]: DANGER,
  [S.cancelled]: DANGER,
};

/**
 * The top of a job: the other side as a round tile, their name, the work and when it is, and the job's status as a
 * tag. `them` is the name as the card shows it; `from` is the language the other side wrote the request in.
 */
export function JobHead({ job, them, from }: { job: JobRecord; them: string; from: Lang | undefined }) {
  const { t } = useI18n();
  const status = job.engagement.status;
  return (
    <div className="job-head">
      <Avatar name={them} size={AvatarSize.md} tone={AvatarTone.rust} />
      <div className={J.who}>
        <strong className={J.name}>{them}</strong>
        <span className={C.muted}>
          {requestWork(t, job.request)}
          {DOT}
          <When request={job.request} from={from} />
        </span>
      </div>
      <span className={`${TAG[status]} end`}>{t(`status.${status}`)}</span>
    </div>
  );
}

/**
 * When the work is: the day from the request's structured detail, shown by this phone in its own words (never
 * translated), then the time as the other side wrote it. A request from before the When chips has only its free text.
 */
function When({ request, from }: { request: JobRequest; from: Lang | undefined }) {
  const { t, lang } = useI18n();
  const day = dayOf(request);
  const time = request.details[WhenDetail.time];
  if (day === undefined) return <Said text={request.when} from={from} />;
  return (
    <>
      {dayWord(day, lang, t)}
      {time && (
        <>
          {DOT}
          <Said text={time} from={from} />
        </>
      )}
    </>
  );
}
