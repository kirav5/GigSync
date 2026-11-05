import { type GigDevice, type MessageKey, RequestState, type SentRequest } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { BusyGroup } from "../../ui/BusyGroup.js";
import { C } from "../../ui/cls.js";
import { Said } from "../../ui/Said.js";
import { useBusy } from "../../ui/useBusy.js";
import { BlockReport } from "./BlockReport.js";
import { MentorFacts } from "./MentorFacts.js";
import { mentorProblem } from "./problems.js";

interface Props {
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  refresh: () => void;
}

const OFFERED: MessageKey = "mentor.offered";

/** How each state of a request reads, by the mentor's name. */
const STATE_LINE: Readonly<Record<RequestState, MessageKey>> = {
  [RequestState.sent]: "mentor.waiting",
  [RequestState.offered]: OFFERED,
  [RequestState.declined]: "mentor.declined",
  [RequestState.closed]: "mentor.closed",
  [RequestState.linked]: "mentor.linked",
};

/**
 * A mentor's yes to this newcomer: who they are by their own card and count, their note in the owner's language, and
 * Accept (which opens the 30-day link and closes the other requests), with Block and Report beside it.
 */
export function OfferCard({ device, run, refresh, request }: Props & { request: SentRequest }) {
  const { t } = useI18n();
  const { busy, guard } = useBusy();
  const [problem, setProblem] = useState<MessageKey>();
  const card = request.card;
  if (!card) return null;
  const name = card.name;
  async function accept() {
    try {
      await guard(() => run(() => device.mentors.confirm(request.channel)));
      refresh();
    } catch (err) {
      setProblem(mentorProblem("accepting a mentor failed", err));
    }
  }
  return (
    <article className={C.card} aria-label={t(OFFERED, { name })}>
      <strong>{t(OFFERED, { name })}</strong>
      <MentorFacts facts={card} />
      {request.note && (
        <blockquote className="mentor-note">
          <Said text={request.note} from={card.languages[0]} />
        </blockquote>
      )}
      <span className={C.muted}>{t("mentor.accept_help")}</span>
      <BusyGroup busy={busy}>
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={() => void accept()}>
            {t("mentor.accept_offer", { name })}
          </button>
        </div>
      </BusyGroup>
      {problem && <p className={C.error}>{t(problem, { name })}</p>}
      <BlockReport device={device} user={request.mentor} name={name} run={run} onBlocked={refresh} />
    </article>
  );
}

/** This newcomer's requests, newest first: waiting ones can be cancelled, offers accepted, every one blocked or reported. */
export function RequestList({ device, run, refresh, requests }: Props & { requests: readonly SentRequest[] }) {
  const { t } = useI18n();
  const { busy, guard } = useBusy();
  const [problem, setProblem] = useState<MessageKey>();
  if (requests.length === 0) return null;
  const title = t("mentor.your_requests");
  async function cancel(r: SentRequest) {
    setProblem(undefined);
    await guard(() => run(() => device.mentors.cancel(r.channel))).catch((err: unknown) =>
      setProblem(mentorProblem("cancel failed", err)),
    );
    refresh();
  }
  return (
    <section className={C.stack} aria-label={title}>
      <span className={C.label}>{title}</span>
      <BusyGroup busy={busy}>
        {requests.map((r) => {
          const name = r.card?.name ?? r.profile.first_name;
          if (r.state === RequestState.offered)
            return <OfferCard key={r.channel} device={device} run={run} refresh={refresh} request={r} />;
          return (
            <div key={r.channel} className="mentor-request-row">
              <span>{t(STATE_LINE[r.state], { name })}</span>
              {r.state === RequestState.sent && (
                <>
                  <button type={C.button} className={C.quiet} onClick={() => void cancel(r)}>
                    {t("mentor.cancel")}
                  </button>
                  <BlockReport device={device} user={r.mentor} name={name} run={run} onBlocked={refresh} />
                </>
              )}
            </div>
          );
        })}
      </BusyGroup>
      {problem && <p className={C.error}>{t(problem, { name: "" })}</p>}
    </section>
  );
}
