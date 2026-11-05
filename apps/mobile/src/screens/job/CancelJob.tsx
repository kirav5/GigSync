import { StopReason } from "@gigsync/protocol";
import { type ReactNode, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

interface Props {
  /** The work has started: from here the job is stopped with a reason, not cancelled (ADR 0054). */
  started?: boolean;
  onCancel: (stop?: StopReason) => void;
  children?: ReactNode;
}

/**
 * "Cancel this job", which asks once more before it acts: a signed job is called off for both sides, so a slip of the
 * thumb must not do it. Once the work has started it is "Stop this job", and each answer is the reason it stopped.
 * `children` are the moves shown beside it while the owner has not asked to cancel.
 */
export function CancelJob({ started = false, onCancel, children }: Props) {
  const { t } = useI18n();
  const [sure, setSure] = useState(false);
  const ask = t(started ? "job.stop_why" : "restored.cancel_sure");
  if (sure)
    return (
      <fieldset className={C.actions} aria-label={ask}>
        <span>{ask}</span>
        {started ? (
          StopReason.options.map((why) => (
            <button key={why} type={C.button} className={C.danger} onClick={() => onCancel(why)}>
              {t(`stop.${why}`)}
            </button>
          ))
        ) : (
          <button type={C.button} className={C.danger} onClick={() => onCancel()}>
            {t("restored.cancel_yes")}
          </button>
        )}
        <button type={C.button} className={C.secondary} onClick={() => setSure(false)}>
          {t("restored.keep")}
        </button>
      </fieldset>
    );
  return (
    <div className={C.actions}>
      {children}
      <button type={C.button} className={C.quiet} onClick={() => setSure(true)}>
        {t(started ? "job.stop" : "restored.cancel")}
      </button>
    </div>
  );
}
