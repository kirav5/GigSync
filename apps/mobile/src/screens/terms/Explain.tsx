import { type Explanation, type GigDevice, type JobRecord, log } from "@gigsync/core";
import type { Lang } from "@gigsync/protocol";
import { useEffect, useState } from "react";
import { useI18n } from "../../i18n.js";

/**
 * Explanations already made on this phone, by job, offer and language: an offer's facts never change, so its
 * explanation is asked of the model once. Kept in memory only; never sent and never stored.
 */
const made = new Map<string, Explanation>();
const keyOf = (job: JobRecord, index: number, lang: Lang) => `${job.engagement.id}|${index}|${lang}`;

/**
 * Why an offer is what it is, under it in the agents' talk (ADR 0033 §4): the phone's model words the facts when its
 * numbers all match them, else the template sentence. Only ever shown to this owner, with their own limit in it.
 */
export function Explain({
  device,
  job,
  index,
  them,
}: {
  device: GigDevice;
  job: JobRecord;
  index: number;
  them: string;
}) {
  const { lang, t } = useI18n();
  const key = keyOf(job, index, lang);
  const [shown, setShown] = useState<Explanation | undefined>(made.get(key));

  useEffect(() => {
    const known = made.get(key);
    if (known) return setShown(known);
    let live = true;
    void device.talks
      .explain(job.engagement.id, index, them, lang)
      .then((e) => {
        made.set(key, e);
        if (live) setShown(e);
      })
      .catch((err: unknown) => log.warn("explanation failed", { error: err instanceof Error ? err.name : "unknown" }));
    return () => {
      live = false;
    };
  }, [device, job.engagement.id, index, them, lang, key]);

  if (!shown) return null;
  return (
    <p className="offer-why" role="note" aria-label={t("explain.label")} data-by={shown.by}>
      {shown.text}
    </p>
  );
}
