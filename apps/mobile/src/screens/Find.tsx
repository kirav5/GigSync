import { type GigDevice, log, type Ports, QUESTIONS, questionText } from "@gigsync/core";
import { type BoardWorker, Lang, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { type Account, apiClient, rememberName } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { AREAS, areaLabel, areaNamed, money, toPaise } from "../ui/places.js";
import { Said } from "../ui/Said.js";

const RADII_KM = [5, 10, 25] as const;
/** The consumer's agent opens at this share of their budget and concedes toward the full budget. */
const OPENING_SHARE = 0.7;

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  onAsked: () => void;
}

/** The language a worker writes their card in: the first one they listed that the app knows. */
const cardLang = (w: BoardWorker) => w.languages.map((l) => Lang.safeParse(l)).find((p) => p.success)?.data;

/** Find workers near you for one need, then let your agent ask the ones you pick. Your budget stays here. */
export function Find({ ports, account, device, onAsked }: Props) {
  const { lang, t, plural } = useI18n();
  const [trade, setTrade] = useState<Trade>(Trade.enum.electrician);
  const [area, setArea] = useState<string>(AREAS[0].name);
  const [found, setFound] = useState<BoardWorker[]>();
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  /** A listed language, named in the owner's language when the app knows it, else its code. */
  const languageName = (code: string) => {
    const known = Lang.safeParse(code);
    return known.success ? t(`lang.${known.data}`) : code;
  };

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
      log.warn("search failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t("error.generic"));
    }
  }

  const first = QUESTIONS[trade][0];
  const firstQuestion = first ? questionText(lang, first) : "";

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    const budget = toPaise(String(v.get("budget")));
    const detail = String(v.get("detail") ?? "").trim();
    if (!(budget > 0)) return setError(t("find.err_budget"));
    if (picked.length === 0) return setError(t("find.err_pick"));
    const at = areaNamed(area);
    for (const w of found ?? []) if (picked.includes(w.user)) await rememberName(ports, w.user, w.display_name);
    await device.request(
      {
        trade,
        need: String(v.get("need") ?? "").trim(),
        when: String(v.get("when") ?? "").trim(),
        area: { lat: at.lat, lon: at.lon },
        details: first && detail ? { [first]: detail } : {},
        budget: { opening_paise: Math.round(budget * OPENING_SHARE), limit_paise: budget },
      },
      picked as BoardWorker["user"][],
    );
    onAsked();
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.find")}</span>
        <h1 className={C.headline}>
          {t("find.headline")} <span className={C.soft}>{t("find.soft")}</span>
        </h1>
      </div>
      <form className={C.card} onSubmit={(e) => void search(e)} aria-label={t("a11y.search")}>
        <div className={C.row}>
          <select
            className={C.field}
            aria-label={t("find.trade")}
            value={trade}
            onChange={(e) => setTrade(e.target.value as Trade)}
          >
            {Trade.options.map((tr) => (
              <option key={tr} value={tr}>
                {t(`trade.${tr}`)}
              </option>
            ))}
          </select>
          <select
            className={C.field}
            aria-label={t("find.area")}
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            {AREAS.map((a) => (
              <option key={a.key} value={a.name}>
                {t(`area.${a.key}`)}
              </option>
            ))}
          </select>
          <select className={C.field} aria-label={t("find.within")} name="radius" defaultValue={RADII_KM[0]}>
            {RADII_KM.map((r) => (
              <option key={r} value={r}>
                {t("find.within_km", { km: r })}
              </option>
            ))}
          </select>
          <button type="submit" className={C.btn}>
            {t("find.search")}
          </button>
        </div>
      </form>

      {found && found.length === 0 && <div className={C.empty}>{t("find.nobody")}</div>}
      {found && found.length > 0 && (
        <form className={C.stack} onSubmit={(e) => void ask(e)} aria-label={t("a11y.ask_workers")}>
          {found.map((w) => (
            <label key={w.user} className={C.card} aria-label={t("a11y.worker", { name: w.display_name })}>
              <div className={C.row}>
                <input
                  type="checkbox"
                  aria-label={t("a11y.ask_worker", { name: w.display_name })}
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
                    {w.trades.map((tr) => t(`trade.${tr}`)).join(", ")} · {areaLabel(lang, w.area_name)} ·{" "}
                    {t("find.distance", { km: w.distance_km })}
                  </span>
                  {w.languages.length > 0 && (
                    <span className={C.faint}>{w.languages.map(languageName).join(", ")}</span>
                  )}
                </div>
                <span className={`${C.money} end`}>{t("find.from", { price: money(w.rate_paise) })}</span>
              </div>
              {w.about && (
                <span className={C.faint}>
                  <Said text={w.about} from={cardLang(w)} />
                </span>
              )}
            </label>
          ))}
          <div className={C.card}>
            <span className={C.label}>{t("find.need_label")}</span>
            <input
              className={C.field}
              name="need"
              required
              aria-label={t("find.need_label")}
              placeholder={t("find.need_example")}
            />
            <input
              className={C.field}
              name="detail"
              aria-label={firstQuestion}
              placeholder={t("find.optional", { question: firstQuestion })}
            />
            <input
              className={C.field}
              name="when"
              required
              aria-label={t("find.when")}
              placeholder={t("find.when_example")}
            />
            <input
              className={C.field}
              name="budget"
              required
              inputMode="numeric"
              aria-label={t("find.budget")}
              placeholder={t("find.budget")}
            />
            {error && <p className={C.error}>{error}</p>}
            <div>
              <button type="submit" className={C.accent}>
                {plural("find.ask", picked.length)}
              </button>
            </div>
          </div>
        </form>
      )}
      {error && !found && <p className={C.error}>{error}</p>}
    </>
  );
}
