import type { MessageKey, StartProblem } from "@gigsync/core";
import { City, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { useBusy } from "../../ui/useBusy.js";
import type { MovePicks } from "./useLanding.js";

interface Props {
  /** The city Talk heard, if any. */
  city: City | undefined;
  /** The trade on the owner's card, if they have one. */
  trade: Trade | undefined;
  onStart: (picks: MovePicks) => Promise<StartProblem | undefined>;
}

const ARRIVAL = "arrival";

/** The owner picks the city (only cities with a guide), the day they arrive and their work, then starts the guide. */
export function LandingStart({ city, trade, onStart }: Props) {
  const { t } = useI18n();
  const [chosenCity, setCity] = useState<City | undefined>(
    city ?? (City.options.length === 1 ? City.options[0] : undefined),
  );
  const [chosenTrade, setTrade] = useState<Trade | undefined>(trade);
  const { busy, guard } = useBusy();
  const [problem, setProblem] = useState<StartProblem>();
  const title = t("landing.start_title");

  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const arrival = String(new FormData(e.currentTarget).get(ARRIVAL) ?? "");
    await guard(async () => setProblem(await onStart({ city: chosenCity ?? "", arrival, trade: chosenTrade ?? "" })));
  }

  return (
    <form className={C.card} aria-label={title} onSubmit={(e) => void start(e)}>
      <h2 className={C.title}>{title}</h2>
      <fieldset className={C.row} aria-label={t("landing.city")}>
        {City.options.map((c) => (
          <button
            key={c}
            type={C.button}
            aria-pressed={chosenCity === c}
            className={chosenCity === c ? C.chipOn : C.chip}
            onClick={() => setCity(c)}
          >
            {t(`landing.city.${c}`)}
          </button>
        ))}
      </fieldset>
      <span className={C.faint}>{t("landing.city_only")}</span>
      <label className={C.fieldLabel}>
        {t("landing.arrival")}
        <input className={C.field} type="date" name={ARRIVAL} required />
      </label>
      <span className={C.label}>{t("landing.trade")}</span>
      <fieldset className={C.row} aria-label={t("landing.trade")}>
        {Trade.options.map((tr) => (
          <button
            key={tr}
            type={C.button}
            aria-pressed={chosenTrade === tr}
            className={chosenTrade === tr ? C.chipOn : C.chip}
            onClick={() => setTrade(tr)}
          >
            {t(`trade.${tr}`)}
          </button>
        ))}
      </fieldset>
      <div className={C.actions}>
        <button type={C.submit} className={C.accent} disabled={busy} aria-busy={busy}>
          {t("landing.start")}
        </button>
      </div>
      {problem && (
        <p role="alert" className={C.error}>
          {t(`landing.problem_${problem}` satisfies MessageKey)}
        </p>
      )}
    </form>
  );
}
