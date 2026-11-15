import type { MessageKey, Ports, StartProblem } from "@gigsync/core";
import { City, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useServedCities } from "../../adapters/cities.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { useBusy } from "../../ui/useBusy.js";
import { PageFrame } from "../pages/PageFrame.js";
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

/** One chip of a set where one is picked: pressed when picked, as the kit's chips are. */
function Chip({ on, name, onPick }: { on: boolean; name: string; onPick: () => void }) {
  return (
    <button type={C.button} aria-pressed={on} className={on ? C.chipOn : C.chip} onClick={onPick}>
      {name}
    </button>
  );
}

/** The day and the work, in one card, for a city with a guide. */
function YourMove({ trade, onTrade }: { trade: Trade | undefined; onTrade: (t: Trade) => void }) {
  const { t } = useI18n();
  const title = t("landing.your_move");
  return (
    <section className={`${C.card} move-plan`} aria-label={title}>
      <span className={C.label}>{title}</span>
      <label className={C.fieldLabel}>
        {t("landing.arrival")}
        <input className={C.field} type="date" name={ARRIVAL} required />
      </label>
      <span className={C.fieldLabel}>{t("landing.trade")}</span>
      <fieldset className={C.row} aria-label={t("landing.trade")}>
        {Trade.options.map((tr) => (
          <Chip key={tr} on={trade === tr} name={t(`trade.${tr}`)} onPick={() => onTrade(tr)} />
        ))}
      </fieldset>
    </section>
  );
}

/**
 * Where are you moving? (design W18): the question and one line on what a move here gives, the city as chips, what you
 * get there, then the day and the work in one card and "Start my move", the one primary, for a city with a guide. Any
 * other city, or Somewhere else, gets what helps anywhere instead, since there is no guide to follow. The day stays a
 * date (the journey counts from it) and the work is the card's until the owner picks another.
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

  return (
    <PageFrame title={title} subtitle={t("landing.start_lead")}>
      <form className="move-start" aria-label={title} onSubmit={(e) => void start(e)}>
        <fieldset className={C.row} aria-label={t("landing.city")}>
          {chips.map((c) => (
            <Chip key={c.key} on={chosen === c.key} name={c.name} onPick={() => setChosen(c.key)} />
          ))}
          <Chip on={chosen === ELSEWHERE} name={t("me.move_elsewhere")} onPick={() => setChosen(ELSEWHERE)} />
        </fieldset>
        <ComesWithYou
          ports={ports}
          account={account}
          city={guide}
          picked={chosen !== undefined}
          trade={trade}
          onFindMentor={onFindMentor}
        />
        {chosen !== undefined && !guide && <NoGuideCity />}
        {guide && (
          <>
            <YourMove trade={trade} onTrade={setTrade} />
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
    </PageFrame>
  );
}
