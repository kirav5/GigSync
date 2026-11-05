import { log, PayeeMissingError } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../i18n.js";
import { errorKey } from "../ui/errorKey.js";

export type Run = (work: () => Promise<unknown>) => Promise<unknown>;
/** One step of a job; `done` runs if it went through, as when a form closes itself. */
export type Step = (work: () => Promise<unknown>, done?: () => void) => void;

/** Runs one step of a job through the sync queue, and says what went wrong: no UPI ID saved, or anything else. */
export function useStep(run: Run) {
  const { t } = useI18n();
  const [error, setError] = useState<string>();
  const [missing, setMissing] = useState(false);
  const step: Step = (work, done) => {
    setError(undefined);
    run(work)
      .then(done)
      .catch((err: unknown) => {
        if (err instanceof PayeeMissingError) return setMissing(true);
        log.warn("job step failed", { error: err instanceof Error ? err.message : String(err) });
        setError(t(errorKey(err)));
      });
  };
  return { step, error, missing };
}
