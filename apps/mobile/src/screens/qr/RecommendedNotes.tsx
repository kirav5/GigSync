import { type GigDevice, recommendedJobs } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { BusyGroup } from "../../ui/BusyGroup.js";
import { C } from "../../ui/cls.js";
import { useBusy } from "../../ui/useBusy.js";
import type { GigView } from "../../useGig.js";

interface Props {
  view: GigView;
  device: GigDevice;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
}

/**
 * On a worker's Home: a household they worked for recommended them to someone (ADR 0055). Told, not asked: if that
 * person asks, it comes as a usual request they may decline. OK puts it away. Nothing shows without one.
 */
export function RecommendedNotes({ view, device, run }: Props) {
  const { t } = useI18n();
  const { busy, guard } = useBusy();
  const jobs = recommendedJobs(view.jobs);
  if (jobs.length === 0) return null;
  return (
    <BusyGroup busy={busy}>
      {jobs.map((job) => {
        const { id, counterpart } = job.engagement;
        const name = view.names[counterpart] || job.contact?.name || job.their_name || t("job.customer");
        const line = t("qr.recommended", { name });
        return (
          <article key={id} className={C.cardWait} aria-label={line}>
            <strong>{line}</strong>
            <span className={C.muted}>{t("qr.recommended_about")}</span>
            <div className={C.actions}>
              <button
                type={C.button}
                className={C.secondary}
                onClick={() => void guard(() => run(() => device.recommendations.read(id)))}
              >
                {t("qr.recommended_ok")}
              </button>
            </div>
          </article>
        );
      })}
    </BusyGroup>
  );
}
