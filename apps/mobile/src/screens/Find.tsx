import {
  EVERY_DAY,
  type GigDevice,
  isMonthly,
  localDay,
  log,
  type MessageKey,
  type Ports,
  parseAmount,
  QUESTIONS,
  questionText,
  WhenDetail,
} from "@gigsync/core";
import { type BoardWorker, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { type Account, apiClient, rememberName } from "../adapters/account.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { errorKey } from "../ui/errorKey.js";
import { AREAS, areaNamed } from "../ui/places.js";
import { SiteForm } from "./colleague/SiteForm.js";
import { WorkerPick } from "./colleague/WorkerPick.js";
import { dayDate } from "./jobGroups.js";

const RADII_KM = [5, 10, 25] as const;
/** The consumer's agent opens at this share of their budget and concedes toward the full budget. */
const OPENING_SHARE = 0.7;
/** Ties the dock's Ask button, outside the form, to it. */
const ASK_FORM = "ask-workers";
/** The forms' field names. */
const F = { radius: "radius", need: "need", detail: "detail", day: "day", time: "time", budget: "budget" } as const;
/** `JobRequest.when` holds at most 100 characters: the chip's words, then this much time text. */
const TIME_MAX = 60;
const MS_PER_DAY = 86_400_000;

/** The When chips. Each writes `details.day`, which each phone files under Today or Coming up itself. */
const When = { today: "today", tomorrow: "tomorrow", pick: "pick", daily: "daily" } as const;
type When = (typeof When)[keyof typeof When];
const WHEN_CHIPS: readonly { when: When; label: MessageKey }[] = [
  { when: When.today, label: "when.today" },
  { when: When.tomorrow, label: "when.tomorrow" },
  { when: When.pick, label: "when.pick" },
  { when: When.daily, label: "when.daily" },
];

interface Props {
  ports: Ports;
  account: Account;
  device: GigDevice;
  onAsked: () => void;
  /** A worker hiring a helper for their own work (round2-spec §3.3 A), opened from Talk. */
  hire?: boolean;
  /** The account after the work site was saved. */
  onAccount: (a: Account) => void;
}

/**
 * Find workers near you for one need, then let your agent ask the ones you pick. Your budget stays here. A worker
 * hiring is asked first where the work is, if their card has no address; their own card never shows.
 */
export function Find({ ports, account, device, onAsked, hire = false, onAccount }: Props) {
  const { lang, t, plural, date } = useI18n();
  const [trade, setTrade] = useState<Trade>(Trade.enum.electrician);
  const [area, setArea] = useState<string>(AREAS[0].name);
  const [found, setFound] = useState<BoardWorker[]>();
  const [picked, setPicked] = useState<string[]>([]);
  /** The chip the owner tapped; until then monthly work defaults to every day, anything else to today. */
  const [chosen, setChosen] = useState<When>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const when = chosen ?? (isMonthly(trade) ? When.daily : When.today);

  /** The phone's calendar day, `days` from now: what "Today" and "Tomorrow" mean where the owner is. */
  const dayFromNow = (days: number) => {
    const now = ports.clock.now();
    return localDay(new Date(now.getTime() + days * MS_PER_DAY), -now.getTimezoneOffset());
  };

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const radius = Number(new FormData(e.currentTarget).get(F.radius));
    const { lat, lon } = areaNamed(area);
    try {
      const board = await apiClient(account.session).searchWorkers({ trade, lat, lon, radius_km: radius });
      const workers = board.filter((w) => w.user !== account.session.user);
      setFound(workers);
      setPicked(workers.slice(0, 1).map((w) => w.user));
      setError(undefined);
    } catch (err) {
      log.warn("search failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(errorKey(err)));
    }
  }

  const first = QUESTIONS[trade][0];
  const firstQuestion = first ? questionText(lang, first) : "";

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const v = new FormData(e.currentTarget);
    const budget = parseAmount(String(v.get(F.budget) ?? ""));
    const detail = String(v.get(F.detail) ?? "").trim();
    const time = String(v.get(F.time) ?? "").trim();
    if (!budget) return setError(t("find.err_budget"));
    if (picked.length === 0) return setError(t("find.err_pick"));
    const pickedDay = String(v.get(F.day) ?? "");
    const day =
      when === When.pick ? pickedDay : when === When.daily ? EVERY_DAY : dayFromNow(when === When.today ? 0 : 1);
    // Older phones and the agent read `when`, and it becomes the signed slot: the date itself, never "Today" or
    // "Tomorrow", which are true only on the day they are sent ("कल" is also yesterday). Then the time.
    const label = when === When.daily ? t("when.daily") : date(dayDate(day));
    const at = areaNamed(area);
    setBusy(true);
    try {
      for (const w of found ?? []) if (picked.includes(w.user)) await rememberName(ports, w.user, w.display_name);
      await device.request(
        {
          trade,
          need: String(v.get(F.need) ?? "").trim(),
          when: time ? `${label} ${time}` : label,
          area: { lat: at.lat, lon: at.lon },
          details: {
            ...(first && detail ? { [first]: detail } : {}),
            [WhenDetail.day]: day,
            ...(time ? { [WhenDetail.time]: time } : {}),
          },
          budget: { opening_paise: Math.round(budget * OPENING_SHARE), limit_paise: budget },
        },
        picked as BoardWorker["user"][],
      );
      onAsked();
    } catch (err) {
      log.warn("asking workers failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  if (hire && !account.contact.address) return <SiteForm ports={ports} account={account} ask onSaved={onAccount} />;
  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.find")}</span>
        {hire ? (
          <h1 className={C.headline}>{t("hire.title")}</h1>
        ) : (
          <h1 className={C.headline}>
            {t("find.headline")} <span className={C.soft}>{t("find.soft")}</span>
          </h1>
        )}
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
          <select className={C.field} aria-label={t("find.within")} name={F.radius} defaultValue={RADII_KM[0]}>
            {RADII_KM.map((r) => (
              <option key={r} value={r}>
                {t("find.within_km", { km: r })}
              </option>
            ))}
          </select>
          <button type={C.submit} className={C.btn}>
            {t("find.search")}
          </button>
        </div>
      </form>

      {found && found.length === 0 && <div className={C.empty}>{t("find.nobody")}</div>}
      {found && found.length > 0 && (
        <form id={ASK_FORM} className={C.stack} onSubmit={(e) => void ask(e)} aria-label={t("a11y.ask_workers")}>
          {found.map((w) => (
            <WorkerPick
              key={w.user}
              worker={w}
              picked={picked.includes(w.user)}
              onToggle={() => setPicked((p) => (p.includes(w.user) ? p.filter((x) => x !== w.user) : [...p, w.user]))}
            />
          ))}
          <div className={C.card}>
            <span className={C.label}>{t("find.need_label")}</span>
            <input
              className={C.field}
              name={F.need}
              required
              aria-label={t("find.need_label")}
              placeholder={t("find.need_example")}
            />
            <input
              className={C.field}
              name={F.detail}
              aria-label={firstQuestion}
              placeholder={t("find.optional", { question: firstQuestion })}
            />
            <span className={C.label}>{t("find.when")}</span>
            <fieldset className={C.row} aria-label={t("find.when")}>
              {WHEN_CHIPS.map((c) => (
                <button
                  key={c.when}
                  type={C.button}
                  aria-pressed={when === c.when}
                  className={when === c.when ? C.chipOn : C.chip}
                  onClick={() => setChosen(c.when)}
                >
                  {t(c.label)}
                </button>
              ))}
            </fieldset>
            {when === When.pick && (
              <input
                className={C.field}
                type="date"
                name={F.day}
                required
                min={dayFromNow(0)}
                aria-label={t("when.pick")}
              />
            )}
            <input
              className={C.field}
              name={F.time}
              maxLength={TIME_MAX}
              aria-label={t("when.time")}
              placeholder={t("when.time")}
            />
            <input
              className={C.field}
              name={F.budget}
              required
              inputMode="numeric"
              aria-label={t("find.budget")}
              placeholder={t("find.budget")}
            />
          </div>
          <Dock>
            <p className={C.dockError} role="status" aria-live="polite">
              {error}
            </p>
            <button type={C.submit} form={ASK_FORM} className={C.wide} disabled={busy}>
              {plural("find.ask", picked.length)}
            </button>
          </Dock>
        </form>
      )}
      {error && !found?.length && <p className={C.error}>{error}</p>}
    </>
  );
}
