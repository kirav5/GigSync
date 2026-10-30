import { log, type MessageKey, type Ports, setUsualTactic, TACTICS, Tactic, usualTactic } from "@gigsync/core";
import { useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";

const LABEL: Readonly<Record<Tactic, MessageKey>> = {
  [Tactic.patient]: "bargain.patient",
  [Tactic.steady]: "bargain.steady",
  [Tactic.quick]: "bargain.quick",
};

const failure = (err: unknown) => ({ error: err instanceof Error ? err.name : typeof err });

/**
 * Settings' "How your agent bargains, usually: Patient / Steady / Quick" (ADR 0033). Each job still draws its own
 * hidden opening and pace inside the chosen tactic's ranges; a household's words for one job can choose for that job.
 */
export function TacticSetting({ ports }: { ports: Ports }) {
  const { t } = useI18n();
  const [tactic, setTactic] = useState<Tactic>();

  useEffect(() => {
    usualTactic(ports.storage)
      .then(setTactic)
      .catch((err: unknown) => log.warn("loading the bargaining setting failed", failure(err)));
  }, [ports]);

  function choose(next: Tactic) {
    setUsualTactic(ports.storage, next)
      .then(() => setTactic(next))
      .catch((err: unknown) => log.warn("saving the bargaining setting failed", failure(err)));
  }

  const label = t("bargain.label");
  return (
    <section className={C.card} aria-label={label}>
      <span className={C.label}>{label}</span>
      <span className={C.muted}>{t("bargain.what")}</span>
      <div className={C.row}>
        {TACTICS.map((option) => (
          <button
            key={option}
            type={C.button}
            aria-pressed={tactic === option}
            className={tactic === option ? C.chipOn : C.chip}
            onClick={() => choose(option)}
          >
            {t(LABEL[option])}
          </button>
        ))}
      </div>
    </section>
  );
}
