import { type GigDevice, type Ports, QUESTIONS, questionText, t } from "@gigsync/core";
import { type BoardWorker, Lang, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { type Account, apiClient, rememberName } from "../adapters/account.js";
import { C } from "../ui/cls.js";
import { AREAS, areaNamed, money, TRADE_LABEL, toPaise } from "../ui/places.js";

const RADII_KM = [5, 10, 25] as const;
/** The consumer's agent opens at this share of their budget and concedes toward the full budget. */
const OPENING_SHARE = 0.7;

/** A language a worker listed, named in the owner's language when the app has strings for it, else its code. */
function languageName(owner: Lang, code: string): string {
  const known = Lang.safeParse(code);
  return known.success ? t(owner, `lang.${known.data}`) : code;
}

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  lang: Lang;
  onAsked: () => void;
}

/** Find workers near you for one need, then let your agent ask the ones you pick. Your budget stays here. */
export function Find({ ports, account, device, lang, onAsked }: Props) {
  const [trade, setTrade] = useState<Trade>(Trade.enum.electrician);
  const [area, setArea] = useState(AREAS[0]?.name ?? "");
  const [found, setFound] = useState<BoardWorker[]>();
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const radius = Number(new FormData(e.currentTarget).get("radius"));
    const at = areaNamed(area);
    try {
      const workers = await apiClient(account.session).searchWorkers({
        trade,
        lat: at.lat,
        lon: at.lon,
        radius_km: radius,
      });
      setFound(workers);
      setPicked(workers.slice(0, 1).map((w) => w.user));
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const first = QUESTIONS[trade][0];
  const firstQuestion = first ? questionText(lang, first) : "";

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const budget = toPaise(String(v.get("budget")));
    const question = QUESTIONS[trade][0];
    const detail = String(v.get("detail") ?? "").trim();
    if (!(budget > 0)) return setError("Enter the most you want to pay.");
    if (picked.length === 0) return setError("Pick at least one worker.");
    const at = areaNamed(area);
    for (const w of found ?? []) if (picked.includes(w.user)) await rememberName(ports, w.user, w.display_name);
    await device.request(
      {
        trade,
        need: String(v.get("need") ?? "").trim(),
        when: String(v.get("when") ?? "").trim(),
        area: { lat: at.lat, lon: at.lon },
        details: question && detail ? { [question]: detail } : {},
        budget: { opening_paise: Math.round(budget * OPENING_SHARE), limit_paise: budget },
      },
      picked as BoardWorker["user"][],
    );
    onAsked();
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>Find</span>
        <h1 className={C.headline}>
          Who can help, near you. <span className={C.soft}>Your budget stays on this phone.</span>
        </h1>
      </div>
      <form className={C.card} onSubmit={(e) => void search(e)} aria-label="Search">
        <div className={C.row}>
          <select
            className={C.field}
            aria-label="Trade"
            value={trade}
            onChange={(e) => setTrade(e.target.value as Trade)}
          >
            {Trade.options.map((t) => (
              <option key={t} value={t}>
                {TRADE_LABEL[t]}
              </option>
            ))}
          </select>
          <select className={C.field} aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
            {AREAS.map((a) => (
              <option key={a.name}>{a.name}</option>
            ))}
          </select>
          <select className={C.field} aria-label="Within" name="radius" defaultValue={RADII_KM[0]}>
            {RADII_KM.map((r) => (
              <option key={r} value={r}>
                within {r} km
              </option>
            ))}
          </select>
          <button type="submit" className={C.btn}>
            Search
          </button>
        </div>
      </form>

      {found && found.length === 0 && <div className={C.empty}>Nobody nearby yet for that. Try a wider area.</div>}
      {found && found.length > 0 && (
        <form className={C.stack} onSubmit={(e) => void ask(e)} aria-label="Ask workers">
          {found.map((w) => (
            <label key={w.user} className={C.card} aria-label={`Worker ${w.display_name}`}>
              <div className={C.row}>
                <input
                  type="checkbox"
                  aria-label={`Ask ${w.display_name}`}
                  checked={picked.includes(w.user)}
                  onChange={() =>
                    setPicked((p) => (p.includes(w.user) ? p.filter((x) => x !== w.user) : [...p, w.user]))
                  }
                />
                <span className="avatar" aria-hidden="true">
                  {w.display_name.slice(0, 1).toUpperCase()}
                </span>
                <div className="who">
                  <strong>{w.display_name}</strong>
                  <span className={C.muted}>
                    {w.trades.map((tr) => TRADE_LABEL[tr]).join(", ")} · {w.area_name} · {w.distance_km} km
                  </span>
                  {w.languages.length > 0 && (
                    <span className={C.faint}>{w.languages.map((l) => languageName(lang, l)).join(", ")}</span>
                  )}
                </div>
                <span className={`${C.money} end`}>from {money(w.rate_paise)}</span>
              </div>
              {w.about && <span className={C.faint}>{w.about}</span>}
            </label>
          ))}
          <div className={C.card}>
            <span className={C.label}>What you need</span>
            <input
              className={C.field}
              name="need"
              required
              aria-label="What you need"
              placeholder="Ceiling fan stopped working"
            />
            <input
              className={C.field}
              name="detail"
              aria-label={firstQuestion}
              placeholder={`${firstQuestion} (optional)`}
            />
            <input className={C.field} name="when" required aria-label="When" placeholder="Tomorrow 10am" />
            <input
              className={C.field}
              name="budget"
              required
              inputMode="numeric"
              aria-label="Most I will pay, ₹ (private)"
              placeholder="Most I will pay, ₹ (private)"
            />
            {error && <p className={C.error}>{error}</p>}
            <div>
              <button type="submit" className={C.accent}>
                Ask {picked.length} {picked.length === 1 ? "worker" : "workers"}
              </button>
            </div>
          </div>
        </form>
      )}
      {error && !found && <p className={C.error}>{error}</p>}
    </>
  );
}
