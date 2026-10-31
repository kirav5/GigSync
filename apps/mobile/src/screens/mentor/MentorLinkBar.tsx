import type { GigDevice, MentorLink, MessageKey } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { BlockReport } from "./BlockReport.js";
import { LinkChip } from "./LinkChip.js";
import { useLinks } from "./links.js";
import { mentorProblem } from "./problems.js";

interface Props {
  device: GigDevice;
  link: MentorLink;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** After a block the link is gone, and so is its thread. */
  onGone: () => void;
}

/** On a mentor link's thread: who they are to this owner, the days left, Renew for 30 days, and Block and Report. */
export function MentorLinkBar({ device, link, run, onGone }: Props) {
  const { t } = useI18n();
  const { refresh } = useLinks();
  const [said, setSaid] = useState<MessageKey>();
  const name = link.card.name;
  async function renew() {
    try {
      await run(() => device.mentors.renew(link.user));
      refresh();
      setSaid("mentor.renewed");
    } catch (err) {
      setSaid(mentorProblem("renewing a mentor link failed", err));
    }
  }
  return (
    <div className={C.stack}>
      <LinkChip link={link} now={new Date()} />
      <div className={C.row}>
        <button type={C.button} className={C.secondary} onClick={() => void renew()}>
          {t("mentor.renew")}
        </button>
      </div>
      {said && <p role="status">{t(said, { name })}</p>}
      <BlockReport
        device={device}
        user={link.user}
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
