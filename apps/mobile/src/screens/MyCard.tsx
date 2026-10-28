import { CITY_RATES, log, type Ports, QUESTIONS, type WorkerRules, YES_NO_QUESTIONS } from "@gigsync/core";
import { type BoardProfile, Lang, PAISE_PER_RUPEE, type QuestionKey, SEED_SIGNER, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { type Account, apiClient, saveAccount } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { AREAS, areaNamed, money, toPaise } from "../ui/places.js";

const DEFAULT_RADIUS_KM = 10;
const rupeesOf = (paise?: number) => (paise ? String(paise / PAISE_PER_RUPEE) : "");
const ASK_FIELD = "ask.";
/** The rate card's city, as a key for its name in each language. */
const CITY_KEY = "city.bengaluru";

/** Yes-or-no details these trades' agents ask about, which the worker may want to see before any quote. */
const askable = (trades: readonly Trade[]): QuestionKey[] =>
  [...YES_NO_QUESTIONS].filter((k) => trades.some((tr) => QUESTIONS[tr].includes(k)));

/**
 * The worker's card: the public half goes on the board (name, trades, area, usual rate, languages); the private half
 * stays here (lowest rate, UPI ID, how far they travel, what to see first) and is what their agent negotiates with.
 */
export function MyCard({
  ports,
  account,
  onSaved,
}: {
  ports: Ports;
  account: Account;
  onSaved: (a: Account) => void;
  /** Opens Talk to fill the card in by voice. */
  onTalk: () => void;
}) {
  const { lang, t } = useI18n();
  const rules = account.worker;
  const [trades, setTrades] = useState<Trade[]>(rules?.trades ?? []);
  const [spoken, setSpoken] = useState<Lang[]>(account.languages ?? [lang]);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const area = areaNamed(String(v.get("area")));
    const rate = toPaise(String(v.get("rate")));
    const min = toPaise(String(v.get("min")));
    if (trades.length === 0) return setError(t("card.err_trade"));
    if (!(min > 0 && rate >= min)) return setError(t("card.err_rate"));
    // The owner's own language first: it is the one their card's free text is written in.
    const languages = [lang, ...spoken.filter((l) => l !== lang)];
    const card: BoardProfile = {
      display_name: account.contact.name,
      trades,
      area: { lat: area.lat, lon: area.lon },
      area_name: area.name,
      rate_paise: rate,
      languages,
      about: String(v.get("about") ?? "").trim(),
    };
    const worker: WorkerRules = {
      trades,
      rate: { opening_paise: rate, limit_paise: min },
      base: card.area,
      radius_km: DEFAULT_RADIUS_KM,
      vpa: String(v.get("vpa") ?? "").trim(),
      payee_name: account.contact.name,
      rates: CITY_RATES,
      ask_me: askable(trades).filter((k) => v.has(ASK_FIELD + k)),
    };
    try {
      await apiClient(account.session).publishProfile(card);
      const next: Account = { ...account, worker, languages, autoConfirm: v.has("auto") };
      await saveAccount(ports, next);
      setError(undefined);
      setStatus(
        t("card.on_board", {
          trades: trades.map((tr) => t(`trade.${tr}`)).join(", "),
          area: t(`area.${area.key}`),
          price: money(rate),
        }),
      );
      onSaved(next);
    } catch (err) {
      log.warn("publish failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t("error.generic"));
    }
  }

  async function unlist() {
    await apiClient(account.session).removeProfile();
    setStatus(t("card.off_board"));
  }

  const areaName = AREAS.find((a) => a.lat === rules?.base.lat)?.name;
  const bands = CITY_RATES.bands.filter((b) => trades.includes(b.trade));
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.card")}</span>
        <h1 className={C.headline}>
          {t("card.headline")} <span className={C.soft}>{t("card.soft")}</span>
        </h1>
      </div>
      <form className={C.card} onSubmit={(e) => void publish(e)} aria-label={t("a11y.my_card")}>
        <span className={C.label}>{t("card.what")}</span>
        <div className={C.row}>
          {Trade.options.map((tr) => (
            <button
              key={tr}
              type={C.button}
              aria-pressed={trades.includes(tr)}
              className={trades.includes(tr) ? C.chipOn : C.chip}
              onClick={() => setTrades((ts) => toggle(ts, tr))}
            >
              {t(`trade.${tr}`)}
            </button>
          ))}
        </div>
        {bands.map((b) => (
          <span key={b.trade} className={C.faint}>
            {t("card.band", {
              trade: t(`trade.${b.trade}`),
              city: t(CITY_KEY),
              low: money(b.low_paise),
              high: money(b.high_paise),
            })}
          </span>
        ))}
        {bands.length > 0 && CITY_RATES.signed_by === SEED_SIGNER && (
          <span className={C.faint}>{t("card.rates_note", { source: t("rates.seed") })}</span>
        )}
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.where")}</span>
          <select className={C.field} name="area" defaultValue={areaName}>
            {AREAS.map((a) => (
              <option key={a.key} value={a.name}>
                {t(`area.${a.key}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.rate")}</span>
          <input
            className={C.field}
            name="rate"
            inputMode="numeric"
            required
            defaultValue={rupeesOf(rules?.rate.opening_paise)}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.min")}</span>
          <input
            className={C.field}
            name="min"
            inputMode="numeric"
            required
            defaultValue={rupeesOf(rules?.rate.limit_paise)}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.vpa")}</span>
          <input
            className={C.field}
            name="vpa"
            required
            placeholder="name@bank"
            defaultValue={rules?.vpa}
            autoComplete={C.off}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.about")}</span>
          <input className={C.field} name="about" placeholder={t("card.about_example")} />
        </label>
        <span className={C.label}>{t("card.languages")}</span>
        <div className={C.row}>
          {Lang.options.map((l) => (
            <button
              key={l}
              type={C.button}
              lang={l}
              aria-pressed={spoken.includes(l)}
              className={spoken.includes(l) ? C.chipOn : C.chip}
              onClick={() => setSpoken((s) => (l === lang ? s : toggle(s, l)))}
            >
              {t(`lang.${l}`)}
            </button>
          ))}
        </div>
        {askable(trades).map((k) => (
          <label key={k} className={C.row}>
            <input type="checkbox" name={ASK_FIELD + k} defaultChecked={rules?.ask_me?.includes(k)} />
            <span className={C.muted}>{t("card.ask_first", { item: t(`detail.${k}`) })}</span>
          </label>
        ))}
        <label className={C.row}>
          <input type="checkbox" name="auto" defaultChecked={account.autoConfirm} />
          <span className={C.muted}>{t("card.auto")}</span>
        </label>
        {error && <p className={C.error}>{error}</p>}
        {status && <span className="label fresh">{status}</span>}
        <div className={C.row}>
          <button type="submit" className={C.accent}>
            {t("card.publish")}
          </button>
          {rules && (
            <button type={C.button} className={C.secondary} onClick={() => void unlist()}>
              {t("card.unlist")}
            </button>
          )}
        </div>
      </form>
    </>
  );
}
