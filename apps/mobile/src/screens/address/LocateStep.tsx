import type { MessageKey } from "@gigsync/core";
import type { GeoPlace, Place, Session } from "@gigsync/protocol";
import { useState } from "react";
import { currentPoint, geocodingOff, LocateError, LocateFailure, placesAt } from "../../adapters/geo.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/** Where the step is: the button, the reason asked first, the phone looking, or what came of it. */
const Step = { idle: "idle", explain: "explain", locating: "locating" } as const;
type Step = (typeof Step)[keyof typeof Step];

const FAILURE: Readonly<Record<LocateFailure, MessageKey>> = {
  [LocateFailure.denied]: "addr.denied",
  [LocateFailure.failed]: "addr.failed",
  [LocateFailure.off]: "addr.search_off",
};

/**
 * "Use my current location" (ADR 0045): the reason first, in the owner's language, before the phone shows its own
 * permission prompt; then the phone's position, its coarse rounding to GigSync's geocoder, and the locality, city and
 * PIN handed to the form to confirm. The exact point stays on the phone, with the address.
 */
export function LocateStep({
  session,
  onFound,
  onPointOnly,
  precise = false,
  label = "addr.use_location",
}: {
  session: Session;
  /** Ask the phone for its best fix: a household's address, not a worker's area. */
  precise?: boolean;
  /**
   * The phone's point when the server cannot name it (geocoding off, or nothing found there): the caller may still use
   * the point; it returns whether it could, and the step says why not otherwise.
   */
  onPointOnly?: (point: Place) => boolean;
  /** The button's words: a household's "Use my current location", a worker's "for my area". */
  label?: MessageKey;
  /** The place found and the phone's own point, for the form to fill in and the owner to check. */
  onFound: (place: GeoPlace, point: Place) => void;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>(Step.idle);
  const [problem, setProblem] = useState<MessageKey>();

  async function locate() {
    setStep(Step.locating);
    setProblem(undefined);
    try {
      const point = await currentPoint(precise);
      const named: { place?: GeoPlace | undefined; err?: unknown } = await placesAt(session, point).then(
        ([place]) => ({ place }),
        (err: unknown) => ({ err }),
      );
      if (named.place) return onFound(named.place, point);
      if (onPointOnly?.(point)) return;
      if (named.err) throw named.err;
      setProblem("addr.failed");
    } catch (err) {
      const reason = err instanceof LocateError ? err.reason : geocodingOff(err) ? LocateFailure.off : undefined;
      setProblem(FAILURE[reason ?? LocateFailure.failed]);
    } finally {
      setStep(Step.idle);
    }
  }

  if (step === Step.explain)
    return (
      <div className={C.card} role="dialog" aria-label={t("addr.why_title")}>
        <strong>{t("addr.why_title")}</strong>
        <p className={C.muted}>{t("addr.why")}</p>
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={() => void locate()}>
            {t("addr.allow")}
          </button>
          <button type={C.button} className={C.secondary} onClick={() => setStep(Step.idle)}>
            {t("addr.not_now")}
          </button>
        </div>
      </div>
    );
  return (
    <div className={C.stack}>
      <button
        type={C.button}
        className={C.secondary}
        disabled={step === Step.locating}
        onClick={() => setStep(Step.explain)}
      >
        {t(step === Step.locating ? "addr.locating" : label)}
      </button>
      {problem && (
        <p className={C.muted} role="status">
          {t(problem)}
        </p>
      )}
    </div>
  );
}
