import type { MessageKey, Ports, StartProblem } from "@gigsync/core";
import { City, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useServedCities } from "../../adapters/cities.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { useBusy } from "../../ui/useBusy.js";
import { ComesWithYou } from "./ComesWithYou.js";
import { NoGuideCity } from "./NoGuideCity.js";
import type { MovePicks } from "./useLanding.js";

interface Props {
  ports: Ports;
  account: Account;
  /** The city Talk heard, if any. */
  city: City | undefined;
  onStart: (picks: MovePicks) => Promise<StartProblem | undefined>;
  /** Opens Find a mentor, for someone who knows a city with a guide. */
  onFindMentor: () => void;
}

const ARRIVAL = "arrival";
/** The chip for a city GigSync does not serve. */
const ELSEWHERE = "elsewhere";

/** A city to pick: its key (a guide's city or a served city's), and its name in the owner's language. */
interface CityChip {
  key: string;
  name: string;
}

/** The guide's city a picked key is, if it is one. */
const guideOf = (key: string | undefined): City | undefined => City.safeParse(key).data;

/**
 * The cities to pick (design W18): those with a guide first, where a move can start, then the other cities GigSync
 * serves (ADR 0061), each once. Until the served list arrives, the guide cities alone.
 */
function useCityChips(account: Account): CityChip[] {
  const { t, lang } = useI18n();
  const served = useServedCities(account.session) ?? [];
  const guides = City.options.map((c) => ({ key: c, name: t(`landing.city.${c}`) }));
  const others = served.filter((s) => !guideOf(s.key)).map((s) => ({ key: s.key, name: s.names[lang] }));
  return [...guides, ...others];
}

/**
 * Where are you moving? (design W18): the city, what comes along, the day and the work, then "Start my move", the one
 * primary, for a city with a guide; a mentor for that city beside it. Any other city, or Somewhere else, gets what helps
 * anywhere instead, since there is no guide to follow. The day stays a date (the journey counts from it) and the work is
 * the card's until the owner picks another.
 */
export function MoveStart({ ports, account, city, onStart, onFindMentor }: Props) {
  const { t } = useI18n();
  const chips = useCityChips(account);
  const [chosen, setChosen] = useState<string | undefined>(
    city ?? (City.options.length === 1 ? City.options[0] : undefined),
  );
  const [trade, setTrade] = useState<Trade | undefined>(account.worker?.trades[0]);
  const { busy, guard } = useBusy();
  const [problem, setProblem] = useState<StartProblem>();
  const guide = guideOf(chosen);
  const title = t("landing.start_title");

  async function start(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const arrival = String(new FormData(e.currentTarget).get(ARRIVAL) ?? "");
    await guard(async () => setProblem(await onStart({ city: guide ?? "", arrival, trade: trade ?? "" })));
  }

  const chip = (key: string, name: string) => (
    <button
      key={key}
      type={C.button}
      aria-pressed={chosen === key}
      className={chosen === key ? C.chipOn : C.chip}
      onClick={() => setChosen(key)}
    >
      {name}
    </button>
  );

  return (
    <>
      <form className="move-start" aria-label={title} onSubmit={(e) => void start(e)}>
        <h2 className="hero-title">{title}</h2>
        <fieldset className={C.row} aria-label={t("landing.city")}>
          {chips.map((c) => chip(c.key, c.name))}
          {chip(ELSEWHERE, t("me.move_elsewhere"))}
        </fieldset>
        <span className={C.faint}>{t("landing.city_only")}</span>
        <ComesWithYou ports={ports} account={account} city={guide} picked={chosen !== undefined} trade={trade} />
        {chosen !== undefined && !guide && <NoGuideCity />}
        {guide && (
          <>
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
                  aria-pressed={trade === tr}
                  className={trade === tr ? C.chipOn : C.chip}
                  onClick={() => setTrade(tr)}
                >
                  {t(`trade.${tr}`)}
                </button>
              ))}
            </fieldset>
            <button type={C.submit} className={`${C.wide} btn-big`} disabled={busy} aria-busy={busy}>
              {t("landing.start")}
            </button>
          </>
        )}
        {problem && (
          <p role="alert" className={C.error}>
            {t(`landing.problem_${problem}` satisfies MessageKey)}
          </p>
        )}
      </form>
      {guide && (
        // Outside the form: its name holds the city's, which the city chip's name must not share inside it.
        <button type={C.button} className={`${C.secondary} wide`} onClick={onFindMentor}>
          <Icon name="people" size={18} />
          {t("me.move_mentor_in", { city: t(`landing.city.${guide}`) })}
        </button>
      )}
    </>
  );
}
