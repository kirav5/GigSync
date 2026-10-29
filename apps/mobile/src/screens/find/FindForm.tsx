import {
  EVERY_DAY,
  estimateRequest,
  type GigDevice,
  isMonthly,
  localDay,
  log,
  type MessageKey,
  needToSend,
  type Ports,
  parseAmount,
  perJob,
  QUESTIONS,
  questionText,
  SEARCH_RADII_KM,
  suggestForHousehold,
  TIME_MAX,
} from "@gigsync/core";
import { type BoardWorker, Trade } from "@gigsync/protocol";
import { type FormEvent, useRef, useState } from "react";
import type { Account } from "../../adapters/account.js";
import { useEstimate } from "../../estimate/useEstimate.js";
import { askWorkers, dayLabel, searchBoard } from "../../find/ask.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { errorKey } from "../../ui/errorKey.js";
import { AREAS, areaNamed, PILOT_CITY, rupeesOf } from "../../ui/places.js";
import { EstimateBox } from "../estimate/EstimateBox.js";
import { WorkerPick } from "./WorkerPick.js";

/** Ties the dock's Ask button, outside the form, to it. */
const ASK_FORM = "ask-workers";
/** The forms' field names. */
const F = { radius: "radius", need: "need", detail: "detail", day: "day", time: "time", budget: "budget" } as const;
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
}

/**
 * Find as a form: pick the trade and area, search, pick workers, then fill in the need, when and the budget, and let
 * your agent ask them. Your budget stays here.
 */
export function FindForm({ ports, account, device, onAsked }: Props) {
  const i18n = useI18n();
  const { lang, t, plural } = i18n;
  const [trade, setTrade] = useState<Trade>(Trade.enum.electrician);
  const [area, setArea] = useState<string>(AREAS[0].name);
  const [found, setFound] = useState<BoardWorker[]>();
  const [picked, setPicked] = useState<string[]>([]);
  /** The chip the owner tapped; until then monthly work defaults to every day, anything else to today. */
  const [chosen, setChosen] = useState<When>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const when = chosen ?? (isMonthly(trade) ? When.daily : When.today);
  /** The detail as typed, once the owner leaves the field: what the estimate beside the budget is for. */
  const [detail, setDetail] = useState("");
  const budgetField = useRef<HTMLInputElement>(null);

  /** The phone's calendar day, `days` from now: what "Today" and "Tomorrow" mean where the owner is. */
  const dayFromNow = (days: number) => {
    const now = ports.clock.now();
    return localDay(new Date(now.getTime() + days * MS_PER_DAY), -now.getTimezoneOffset());
  };

  async function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const radius = Number(new FormData(e.currentTarget).get(F.radius));
    try {
      const workers = await searchBoard(account, trade, areaNamed(area), radius);
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
  const details = first && detail ? { [first]: detail } : {};
  const estimated = useEstimate(account.session, estimateRequest(PILOT_CITY, trade, details));
  const budget =
    estimated && suggestForHousehold({ estimate: estimated.estimate, trade, city: PILOT_CITY }).budget_paise;
  const fillBudget = (paise: number) => {
    if (budgetField.current) budgetField.current.value = rupeesOf(paise);
  };

  async function ask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const v = new FormData(e.currentTarget);
    const owned = parseAmount(String(v.get(F.budget) ?? ""));
    const typed = String(v.get(F.detail) ?? "").trim();
    const time = String(v.get(F.time) ?? "").trim();
    if (!owned) return setError(t("find.err_budget"));
    if (picked.length === 0) return setError(t("find.err_pick"));
    const pickedDay = String(v.get(F.day) ?? "");
    const day =
      when === When.pick ? pickedDay : when === When.daily ? EVERY_DAY : dayFromNow(when === When.today ? 0 : 1);
    setBusy(true);
    try {
      const need = needToSend({
        trade,
        need: String(v.get(F.need) ?? "").trim(),
        day,
        label: dayLabel(i18n, day),
        time,
        details: first && typed ? { [first]: typed } : {},
        budget_paise: owned,
        area: areaNamed(area),
        estimate: estimated && perJob(estimated.estimate, details),
      });
      await askWorkers(ports, device, need, found ?? [], picked);
      onAsked();
    } catch (err) {
      log.warn("asking workers failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
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
          <select className={C.field} aria-label={t("find.within")} name={F.radius} defaultValue={SEARCH_RADII_KM[0]}>
            {SEARCH_RADII_KM.map((r) => (
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
              onBlur={(e) => setDetail(e.currentTarget.value.trim())}
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
              ref={budgetField}
            />
            {estimated && budget !== undefined && (
              <EstimateBox found={estimated} suggested={[{ field: F.budget, paise: budget, onUse: fillBudget }]} />
            )}
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
