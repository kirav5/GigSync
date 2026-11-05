import { log, PayeeMissingError } from "@gigsync/core";
import { useState } from "react";
import { useI18n } from "../i18n.js";
import { errorKey } from "../ui/errorKey.js";

export type Run = (work: () => Promise<unknown>) => Promise<unknown>;

/** Runs one money step through the sync queue, and says what went wrong: no UPI ID saved, or anything else. */
export function useStep(run: Run) {
  const { t } = useI18n();
  const [error, setError] = useState<string>();
  const [missing, setMissing] = useState(false);
  function step(work: () => Promise<unknown>) {
    setError(undefined);
    run(work).catch((err: unknown) => {
      if (err instanceof PayeeMissingError) return setMissing(true);
      log.warn("payment step failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(errorKey(err)));
    });
  }
  return { step, error, missing };
}
