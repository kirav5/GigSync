import {
  AnswerSource,
  agentTalk,
  type GigDevice,
  type JobRecord,
  type MessageKey,
  OfferNote,
  questionText,
  TalkKind,
  type TalkStep,
  termsLines,
} from "@gigsync/core";
import { isModelQuestion, type Lang, type Question, Role } from "@gigsync/protocol";
import type { ReactNode } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { jobPrice, money } from "../ui/places.js";
import { Said } from "../ui/Said.js";
import { DetailValue } from "./DetailValue.js";
import { Explain } from "./terms/Explain.js";
import { OfferTerms } from "./terms/OfferTerms.js";

/** The note beside an offer far outside the job's estimate (ADR 0030 §5). */
const NOTE: Readonly<Record<OfferNote, MessageKey>> = {
  [OfferNote.below]: "estimate.below",
  [OfferNote.above]: "estimate.above",
};
/** The space between a line's words and its faint note, which JSX would otherwise drop. */
const GAP = " ";
/** Between the terms of one proposal. */
const LIST = ", ";

/**
 * What the two agents said, in order and in the reader's language, as a chat (W9, H9): the other side's turns on the
 * left, this owner's agent's on the right, and what belongs to both (the agreement, the contacts) between them. The
 * request, the worker's agent's questions and the household's answers (translated when the other side wrote them),
 * every offer, the agreement, each signature and the contacts. It ends by saying the reader's own limit never left
 * the phone. It starts folded, even while the assistants talk: the latest offer is the card's one row (TakeOver), and
 * the talk is how it came about, a tap away.
 */
export function AgentTalk({
  job,
  them,
  from,
  device,
}: {
  job: JobRecord;
  them: string;
  from: Lang | undefined;
  device: GigDevice;
}) {
  const { lang, t } = useI18n();
  const steps = agentTalk(job);
  // The request alone is already on the card.
  if (steps.length <= 1) return null;
  const role = job.engagement.role;
  const mine = (by: Role) => by === role;
  /** Who wrote a question: the worker's agent's model, or the app's standard list. */
  const askedBy = (q: Question, byMe: boolean) =>
    !isModelQuestion(q) ? t("ask.standard") : byMe ? t("ask.by_mine") : t("ask.by_theirs", { name: them });

  function line(s: TalkStep): ReactNode {
    switch (s.kind) {
      case TalkKind.request:
        return (
          <>
            {mine(s.by) ? t("talk.request_mine", { name: them }) : t("talk.request_theirs", { name: them })}
            <OfferTerms terms={s.terms} />
          </>
        );
      case TalkKind.questions:
        return (
          <>
            {mine(s.by) ? t("talk.asked_mine") : t("talk.asked_theirs", { name: them })}
            <ul>
              {s.questions.map((q) => (
                <li key={q.key}>
                  {isModelQuestion(q) ? <Said text={q.text} from={q.lang} /> : questionText(lang, q.key)}
                  {GAP}
                  <span className={C.faint}>{askedBy(q, mine(s.by))}</span>
                </li>
              ))}
            </ul>
          </>
        );
      case TalkKind.answers:
        return (
          <>
            {mine(s.by) ? t("talk.answered_mine") : t("talk.answered_theirs", { name: them })}
            <ul>
              {s.answers.map(({ question: q, text, source }) => (
                <li key={q.key}>
                  {isModelQuestion(q) ? <Said text={q.text} from={q.lang} /> : t(`detail.${q.key}`)}:{GAP}
                  <DetailValue value={text} from={mine(s.by) ? undefined : from} />
                  {source && source !== AnswerSource.owner && (
                    <span className={C.faint}>
                      {GAP}
                      {t(source === AnswerSource.memory ? "ask.from_memory" : "ask.from_words")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        );
      case TalkKind.offer: {
        const price = jobPrice(lang, job.request, s.price_paise);
        const said = mine(s.by)
          ? t(s.owner ? "talk.offer_mine_owner" : "talk.offer_mine", { price })
          : t(s.owner ? "talk.offer_theirs_owner" : "talk.offer_theirs", { name: them, price });
        const range = job.estimate && { low: money(job.estimate.low_paise), high: money(job.estimate.high_paise) };
        return (
          <>
            {said}
            {s.note && range && (
              <span className="offer-note" role="note">
                {GAP}
                {t(NOTE[s.note], range)}
              </span>
            )}
            <OfferTerms terms={s.terms} changed={s.changed} />
            <Explain device={device} job={job} index={s.index} them={them} />
          </>
        );
      }
      case TalkKind.agreed: {
        const terms = termsLines(lang, s.terms).join(LIST);
        const agreed = t("talk.agreed", { price: jobPrice(lang, job.request, s.price_paise) });
        return terms ? `${agreed} ${t("terms.proposed", { terms })}` : agreed;
      }
      case TalkKind.signed:
        return mine(s.by) ? t("talk.signed_mine") : t("talk.signed_theirs", { name: them });
      case TalkKind.contacts:
        return t("talk.contacts");
      case TalkKind.ended:
        return t("talk.ended", { reason: t(`cancel.${s.reason}`) });
    }
  }

  /** Which side said it, for the line's mark; the agreement and the contacts belong to both. */
  const side = (s: TalkStep) => ("by" in s ? (mine(s.by) ? "mine" : "theirs") : "both");
  const title = t("talk.title");
  return (
    <details className="job-talk">
      <summary>{title}</summary>
      <p className="section-label">{t("jobcard.talk_sides", { name: them })}</p>
      <ol className="talk" aria-label={title}>
        {steps.map((s, i) => (
          // The story only grows, so a step's place in it is stable.
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
          <li key={i} data-side={side(s)}>
            {line(s)}
          </li>
        ))}
      </ol>
      <p className={C.faint}>{t(role === Role.enum.provider ? "talk.private_provider" : "talk.private_requester")}</p>
    </details>
  );
}
