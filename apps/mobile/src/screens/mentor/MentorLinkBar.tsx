import { type Colleague, type GigDevice, isMentorLink, type MessageKey } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { useColleagues } from "../colleague/context.js";
import { BlockReport } from "./BlockReport.js";
import { LinkChip } from "./LinkChip.js";
import { mentorProblem } from "./problems.js";

interface Props {
  device: GigDevice;
  colleague: Colleague;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** After a block the link is gone, and so is its thread. */
  onGone: () => void;
}

/** On a mentor link's thread: who they are to this owner, the days left, Renew for 30 days, and Block and Report. */
export function MentorLinkBar({ device, colleague, run, onGone }: Props) {
  const { t } = useI18n();
  const { refresh } = useColleagues();
  const [said, setSaid] = useState<MessageKey>();
  if (!isMentorLink(colleague)) return null;
  const name = colleague.card.name;
  async function renew() {
    try {
      await run(() => device.mentors.renew(colleague.user));
      refresh();
      setSaid("mentor.renewed");
    } catch (err) {
      setSaid(mentorProblem("renewing a mentor link failed", err));
    }
  }
  return (
    <div className={C.stack}>
      <LinkChip colleague={colleague} now={new Date()} />
      <div className={C.row}>
        <button type={C.button} className={C.secondary} onClick={() => void renew()}>
          {t("mentor.renew")}
        </button>
      </div>
      {said && <p role="status">{t(said, { name })}</p>}
      <BlockReport
        device={device}
        user={colleague.user}
        name={name}
        run={run}
        onBlocked={() => {
          refresh();
          onGone();
        }}
      />
    </div>
  );
}
