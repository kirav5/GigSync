import type { MessageKey } from "@gigsync/core";
import { StopReason } from "@gigsync/protocol";
import { useId, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { J } from "./look.js";

const R = StopReason.enum;
/** The id of a row's own line, after its title's. */
const SUB_ID = "-sub";
/** Each reason's own line under it; "something else" needs none, and has no words of its own to send (ADR 0054). */
const SUB: Readonly<Partial<Record<StopReason, MessageKey>>> = {
  [R.cannot_finish]: "jobcard.stop_sub.cannot_finish",
  [R.asked_to_stop]: "jobcard.stop_sub.asked_to_stop",
  [R.not_safe]: "jobcard.stop_sub.not_safe",
};

/**
 * Stopping a job once the work started (W17, ADR 0054): one reason is picked first, as a big row, then "Stop and tell
 * {name}" stops it and "Keep going" leaves it be. The other phone shows the reason in its own language. Nothing here
 * says the part done is paid for: a worker who stops part way cannot ask for it, and the advance is their cover.
 */
export function StopJob({
  them,
  onStop,
  onKeep,
}: {
  them: string;
  onStop: (why: StopReason) => void;
  onKeep: () => void;
}) {
  const { t } = useI18n();
  const id = useId();
  const [why, setWhy] = useState<StopReason>();
  const title = t("job.stop_why");
  return (
    <fieldset className={`${C.stack} stop-job`} aria-label={title}>
      <p className={J.heroLine}>{title}</p>
      {StopReason.options.map((r) => {
        const sub = SUB[r];
        const titleId = `${id}-${r}`;
        return (
          <button
            key={r}
            type={C.button}
            className="option-row"
            aria-pressed={why === r}
            aria-labelledby={titleId}
            aria-describedby={sub ? titleId + SUB_ID : undefined}
            onClick={() => setWhy(r)}
          >
            <span className="option-words">
              <span id={titleId}>{t(`stop.${r}`)}</span>
              {sub && (
                <span id={titleId + SUB_ID} className="sub">
                  {t(sub, { name: them })}
                </span>
              )}
            </span>
          </button>
        );
      })}
      <p className={J.fine}>{t("jobcard.stop_told", { name: them })}</p>
      <button type={C.button} className={J.hero} disabled={!why} onClick={() => why && onStop(why)}>
        {t("jobcard.stop_tell", { name: them })}
      </button>
      <button type={C.button} className={J.ghost} onClick={onKeep}>
        {t("jobcard.keep_going")}
      </button>
    </fieldset>
  );
}
