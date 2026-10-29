import type { GigDevice, MessageKey, ReceivedRequest } from "@gigsync/core";
import { useState } from "react";
import { type Account, colleagueCard } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { areaLabel } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { BlockReport } from "./BlockReport.js";
import { mentorProblem } from "./problems.js";

const NOTE_MAX = 300;

interface Props {
  account: Account;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  refresh: () => void;
  ask: ReceivedRequest;
}

/**
 * A newcomer asking this mentor for help, as a decision on Today: who, from where, when they arrive and where they
 * will stay near, their note in the owner's language; Help (with a note of the mentor's own) or Not now, and Block and
 * Report.
 */
export function AskCard({ account, device, run, refresh, ask }: Props) {
  const { lang, t, date } = useI18n();
  const [note, setNote] = useState("");
  const [problem, setProblem] = useState<MessageKey>();
  const r = ask.request;
  const name = r.card.name;
  const line = t("mentor.request_line", {
    name,
    city: t(`mentor.city.${r.city}`),
    trade: t(`trade.${r.trade}`),
    date: date(new Date(`${r.arrival_week}T12:00:00Z`)),
  });
  async function answer(yes: boolean) {
    try {
      const card = colleagueCard(account, lang);
      await run(() => (yes ? device.mentors.offer(ask.channel, card, note) : device.mentors.decline(ask.channel)));
      refresh();
    } catch (err) {
      setProblem(mentorProblem("answering a landing request failed", err));
    }
  }
  return (
    <article className={C.card} aria-label={line}>
      <span>{line}</span>
      {r.area && <span className={C.muted}>{t("mentor.request_near", { area: areaLabel(lang, r.area) })}</span>}
      <span className={C.muted}>
        {t("mentor.speaks", { langs: r.languages.map((l) => t(`lang.${l}`)).join(", ") })}
      </span>
      {r.note && (
        <blockquote className="mentor-note">
          <Said text={r.note} from={r.languages[0]} />
        </blockquote>
      )}
      <label className={C.field}>
        <span className={C.fieldLabel}>{t("mentor.offer_note")}</span>
        <textarea value={note} maxLength={NOTE_MAX} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className={C.actions}>
        <button type={C.button} className={C.accent} onClick={() => void answer(true)}>
          {t("mentor.help", { name })}
        </button>
        <button type={C.button} className={C.secondary} onClick={() => void answer(false)}>
          {t("mentor.not_now")}
        </button>
      </div>
      {problem && <p className={C.error}>{t(problem, { name })}</p>}
      <BlockReport device={device} user={ask.from} name={name} run={run} onBlocked={refresh} />
    </article>
  );
}
