import type { StopReason } from "@gigsync/protocol";
import { type ReactNode, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { J } from "./look.js";
import { StopJob } from "./StopJob.js";

interface Props {
  /** The work has started: from here the job is stopped with a reason, not cancelled (ADR 0054). */
  started?: boolean;
  /** The other side's name as the card shows it, for "Stop and tell {name}". */
  them: string;
  onCancel: (stop?: StopReason) => void;
  /** A line under the quiet button saying when it cancels and when it stops. */
  note?: string | undefined;
  children?: ReactNode;
}

/**
 * "Cancel this job" as a quiet button under the moves, which asks once more before it acts: a signed job is called off
 * for both sides, so a slip of the thumb must not do it. Once the work has started it is "Stop this job", which asks
 * why first (StopJob). `children` are the moves shown above it while the owner has not asked to cancel; asking puts
 * the question in their place, so one decision shows at a time.
 */
export function CancelJob({ started = false, them, onCancel, note, children }: Props) {
  const { t } = useI18n();
  const [sure, setSure] = useState(false);
  if (sure && started) return <StopJob them={them} onStop={onCancel} onKeep={() => setSure(false)} />;
  if (sure) {
    const ask = t("restored.cancel_sure");
    return (
      <fieldset className={C.stack} aria-label={ask}>
        <p className={J.heroLine}>{ask}</p>
        <button type={C.button} className={`${C.danger} wide`} onClick={() => onCancel()}>
          {t("restored.cancel_yes")}
        </button>
        <button type={C.button} className={J.ghost} onClick={() => setSure(false)}>
          {t("restored.keep")}
        </button>
      </fieldset>
    );
  }
  return (
    <div className={C.stack}>
      {children}
      <button type={C.button} className={J.ghost} onClick={() => setSure(true)}>
        <Icon name="close" />
        {t(started ? "job.stop" : "restored.cancel")}
      </button>
      {note && <p className={J.fine}>{note}</p>}
    </div>
  );
}
