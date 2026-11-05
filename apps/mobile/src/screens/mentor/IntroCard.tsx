import type { GigDevice, Introduction, MessageKey } from "@gigsync/core";
import { MentorReply, MentorRole } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { BusyGroup } from "../../ui/BusyGroup.js";
import { C } from "../../ui/cls.js";
import { useBusy } from "../../ui/useBusy.js";
import { BlockReport } from "./BlockReport.js";
import { mentorProblem } from "./problems.js";
import { SafetyCopy } from "./SafetyCopy.js";

interface Props {
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  refresh: () => void;
  intro: Introduction;
  /** The safety words were read on this phone; until then they show first, with their button. */
  safetySeen: boolean;
}

/**
 * An introduction from someone this owner knows: who wants this owner to meet whom, and why (a mentor in the city,
 * or someone moving there); Meet or No thanks, once the safety words are read. After a yes, it waits for the other
 * person.
 */
export function IntroCard({ device, run, refresh, intro, safetySeen }: Props) {
  const { t } = useI18n();
  const { busy, guard } = useBusy();
  const [problem, setProblem] = useState<MessageKey>();
  const name = intro.card.name;
  const city = t(`mentor.city.${intro.city}`);
  const got = intro.other_role === MentorRole.enum.mentor ? "mentor.intro_got_mentor" : "mentor.intro_got_newcomer";
  const line = t(got, { by: intro.by.name, name, city });
  async function answer(reply: MentorReply) {
    try {
      await guard(() => run(() => device.mentors.answerIntro(intro.channel, reply)));
      refresh();
    } catch (err) {
      setProblem(mentorProblem("answering an introduction failed", err));
    }
  }
  if (intro.mine === MentorReply.enum.accept) return <p className={C.muted}>{t("mentor.intro_waiting", { name })}</p>;
  return (
    <article className={C.card} aria-label={line}>
      <span>{line}</span>
      <span className={C.muted}>{intro.card.trades.map((tr) => t(`trade.${tr}`)).join(", ")}</span>
      {!safetySeen ? (
        <SafetyCopy onRead={() => void device.mentors.safetySeen().then(refresh)} />
      ) : (
        <BusyGroup busy={busy}>
          <div className={C.actions}>
            <button type={C.button} className={C.accent} onClick={() => void answer(MentorReply.enum.accept)}>
              {t("mentor.intro_meet", { name })}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => void answer(MentorReply.enum.decline)}>
              {t("mentor.intro_no")}
            </button>
          </div>
        </BusyGroup>
      )}
      {problem && <p className={C.error}>{t(problem, { name })}</p>}
      <BlockReport device={device} user={intro.other} name={name} run={run} onBlocked={refresh} />
    </article>
  );
}
