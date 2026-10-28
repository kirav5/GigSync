import { CITY_RATES, type Ports, QUESTIONS, t, type WorkerRules, YES_NO_QUESTIONS } from "@gigsync/core";
import { type BoardProfile, type Lang, PAISE_PER_RUPEE, type QuestionKey, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { type Account, apiClient, saveAccount } from "../adapters/account.js";
import { C } from "../ui/cls.js";
import { AREAS, areaNamed, money, TRADE_LABEL, toPaise } from "../ui/places.js";

const DEFAULT_RADIUS_KM = 10;
const rupeesOf = (paise?: number) => (paise ? String(paise / PAISE_PER_RUPEE) : "");
const ASK_FIELD = "ask.";

/** Yes-or-no details these trades' agents ask about, which the worker may want to see before any quote. */
const askable = (trades: readonly Trade[]): QuestionKey[] =>
  [...YES_NO_QUESTIONS].filter((k) => trades.some((tr) => QUESTIONS[tr].includes(k)));

/**
 * The worker's card: the public half goes on the board (name, trades, area, usual rate); the private half stays here
 * (lowest rate, UPI ID, how far they travel) and is what their agent negotiates and gets paid with.
 */
export function MyCard({
  ports,
  account,
  lang,
  onSaved,
}: {
  ports: Ports;
  account: Account;
  lang: Lang;
  onSaved: (a: Account) => void;
}) {
  const rules = account.worker;
  const [trades, setTrades] = useState<Trade[]>(rules?.trades ?? []);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();

  const toggle = (t: Trade) => setTrades((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const area = areaNamed(String(v.get("area")));
    const rate = toPaise(String(v.get("rate")));
    const min = toPaise(String(v.get("min")));
    if (trades.length === 0) return setError("Choose at least one trade.");
    if (!(min > 0 && rate >= min)) return setError("Your usual rate must be at least your lowest rate.");
    const card: BoardProfile = {
      display_name: account.contact.name,
      trades,
      area: { lat: area.lat, lon: area.lon },
      area_name: area.name,
      rate_paise: rate,
      languages: [lang],
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
      const next = { ...account, worker, autoConfirm: v.has("auto") };
      await saveAccount(ports, next);
      setError(undefined);
      setStatus(`On the board: ${trades.map((t) => TRADE_LABEL[t]).join(", ")} in ${area.name} from ${money(rate)}`);
      onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function unlist() {
    await apiClient(account.session).removeProfile();
    setStatus("Off the board");
  }

  const areaName = AREAS.find((a) => a.lat === rules?.base.lat)?.name;
  const bands = CITY_RATES.bands.filter((b) => trades.includes(b.trade));
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>My card</span>
        <h1 className={C.headline}>
          Be found. <span className={C.soft}>Your lowest price stays on this phone.</span>
        </h1>
      </div>
      <form className={C.card} onSubmit={(e) => void publish(e)} aria-label="My card">
        <span className={C.label}>What I do</span>
        <div className={C.row}>
          {Trade.options.map((t) => (
            <button
              key={t}
              type={C.button}
              aria-pressed={trades.includes(t)}
              className={trades.includes(t) ? C.chipOn : C.chip}
              onClick={() => toggle(t)}
            >
              {TRADE_LABEL[t]}
            </button>
          ))}
        </div>
        {bands.map((b) => (
          <span key={b.trade} className={C.faint}>
            {TRADE_LABEL[b.trade]}: going rate in {CITY_RATES.city} {money(b.low_paise)}–{money(b.high_paise)} a month.
            Your agent plans each job from it and never goes below your lowest price.
          </span>
        ))}
        <label className={C.fieldLabel}>
          <span className={C.muted}>Where I work</span>
          <select className={C.field} name="area" defaultValue={areaName}>
            {AREAS.map((a) => (
              <option key={a.name}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>Usual rate for a visit, ₹ (shown on the board)</span>
          <input
            className={C.field}
            name="rate"
            inputMode="numeric"
            required
            defaultValue={rupeesOf(rules?.rate.opening_paise)}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>Lowest I will take, ₹ (private)</span>
          <input
            className={C.field}
            name="min"
            inputMode="numeric"
            required
            defaultValue={rupeesOf(rules?.rate.limit_paise)}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>UPI ID to be paid on (private)</span>
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
          <span className={C.muted}>About my work</span>
          <input className={C.field} name="about" placeholder="10 years, wiring and fans" />
        </label>
        {askable(trades).map((k) => (
          <label key={k} className={C.row}>
            <input
              type="checkbox"
              name={ASK_FIELD + k}
              aria-label={`Ask me first: ${k}`}
              defaultChecked={rules?.ask_me?.includes(k)}
            />
            <span className={C.muted}>Ask me before quoting when there are {t(lang, `detail.${k}`)}</span>
          </label>
        ))}
        <label className={C.row}>
          <input type="checkbox" name="auto" defaultChecked={account.autoConfirm} />
          <span className={C.muted}>Let my agent sign deals inside my prices</span>
        </label>
        {error && <p className={C.error}>{error}</p>}
        {status && <span className="label fresh">{status}</span>}
        <div className={C.row}>
          <button type="submit" className={C.accent}>
            Publish my card
          </button>
          {rules && (
            <button type={C.button} className={C.secondary} onClick={() => void unlist()}>
              Take my card off the board
            </button>
          )}
        </div>
      </form>
    </>
  );
}
