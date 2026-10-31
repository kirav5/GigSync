import type { GigDevice, MessageKey } from "@gigsync/core";
import { ReportReason, type UserId } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { mentorProblem } from "./problems.js";

/** Which of the two the owner opened. */
const Open = { none: "none", block: "block", report: "report" } as const;
type Open = (typeof Open)[keyof typeof Open];

interface Props {
  device: GigDevice;
  user: UserId;
  name: string;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** After a block: they are gone from this phone, so whatever showed them closes. */
  onBlocked: () => void;
}

/**
 * Block and Report, on every offer, request and mentor link. Block asks once, then hides them everywhere on this
 * phone and tells the server not to match the two again; Report sends one of the fixed reasons, never any words.
 */
export function BlockReport({ device, user, name, run, onBlocked }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState<Open>(Open.none);
  const [reason, setReason] = useState<ReportReason>();
  const [said, setSaid] = useState<MessageKey>();
  const block = t("mentor.block");
  const reportTitle = t("mentor.report_title", { name });

  async function act(what: string, work: () => Promise<unknown>, done: MessageKey) {
    try {
      await run(work);
      setSaid(done);
      setOpen(Open.none);
      return true;
    } catch (err) {
      setSaid(mentorProblem(what, err));
      return false;
    }
  }

  return (
    <div className="mentor-safety-actions">
      {open === Open.none && (
        <div className={C.row}>
          <button type={C.button} className={C.quiet} onClick={() => setOpen(Open.report)}>
            {t("mentor.report")}
          </button>
          <button type={C.button} className={C.quiet} onClick={() => setOpen(Open.block)}>
            {block}
          </button>
        </div>
      )}
      {open === Open.block && (
        <div className={C.cardWait} role="dialog" aria-label={block}>
          <p>{t("mentor.block_confirm", { name })}</p>
          <div className={C.actions}>
            <button
              type={C.button}
              className={C.danger}
              onClick={() =>
                void act("blocking failed", () => device.mentors.block(user), "mentor.blocked").then(
                  (ok) => ok && onBlocked(),
                )
              }
            >
              {block}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => setOpen(Open.none)}>
              {t("mentor.cancel")}
            </button>
          </div>
        </div>
      )}
      {open === Open.report && (
        <fieldset className={C.cardWait} aria-label={reportTitle}>
          <span className={C.label}>{reportTitle}</span>
          {ReportReason.options.map((r) => (
            <label key={r} className={C.checkRow}>
              <input type="radio" name={`report-${user}`} checked={reason === r} onChange={() => setReason(r)} />
              {t(`mentor.reason.${r}`)}
            </label>
          ))}
          <div className={C.actions}>
            <button
              type={C.button}
              className={C.danger}
              disabled={!reason}
              onClick={() =>
                reason && void act("reporting failed", () => device.mentors.report(user, reason), "mentor.reported")
              }
            >
              {t("mentor.report_send")}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => setOpen(Open.none)}>
              {t("mentor.cancel")}
            </button>
          </div>
        </fieldset>
      )}
      {said && <p role="status">{t(said, { name })}</p>}
    </div>
  );
}
