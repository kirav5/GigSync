import {
  askable,
  asksIn,
  type CardDraft,
  cardArrangements,
  log,
  type Ports,
  parseAmount,
  suggestWork,
  type TermPrefs,
} from "@gigsync/core";
import { Arrangement, Lang, mainArrangement, type Skill, Trade } from "@gigsync/protocol";
import { type FormEvent, useRef, useState } from "react";
import type { Account } from "../adapters/account.js";
import { offerAlerts } from "../adapters/push.js";
import { closeInterview } from "../card/interviewStore.js";
import { AboutPrivateError, accountDraft, DEFAULT_RADIUS_KM, publishCard, unlistCard } from "../card/publish.js";
import { useFileWork } from "../card/useFileWork.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { errorKey } from "../ui/errorKey.js";
import { Icon } from "../ui/Icon.js";
import { AREAS, money, rupeesOf } from "../ui/places.js";
import { cardWork } from "../ui/work.js";
import { AllWork } from "./card/AllWork.js";
import { AreaField, type WorkArea } from "./card/AreaField.js";
import { ArrangementsField, arrangementsValue, otherRates } from "./card/ArrangementsField.js";
import { RateField, RatesField, workRatesIn } from "./card/RatesField.js";
import { SkillsField } from "./card/SkillsField.js";
import { TermPrefsField } from "./card/TermPrefsField.js";
import { CardRates } from "./estimate/CardRates.js";

/** The form's id, so Publish can sit in the dock, outside it. */
const FORM_ID = "my-card";
const Field = { ...RateField, about: "about", asks: "asks", auto: "auto" } as const;
const ASK_FIELD = "ask.";
/** What the board keeps of the line about their work. */
const ABOUT_MAX = 300;

/**
 * The worker's card, to review and change: the public half goes on the board (name, trades, area, usual rate,
 * languages, a line about their work); the private half stays here (lowest rate, what to see first, signing) and is
 * what their agent negotiates with. The UPI ID is not on the card: payment requests read it from About me.
 */
export function MyCard({
  ports,
  account,
  onSaved,
  onTalk,
}: {
  ports: Ports;
  account: Account;
  onSaved: (a: Account) => void;
  /** Opens Talk to fill the card in by voice. */
  onTalk: () => void;
}) {
  const i18n = useI18n();
  const { lang, t } = i18n;
  const draft = accountDraft(account);
  const fileWork = useFileWork(ports, account, lang, onSaved);
  const [trades, setTrades] = useState<Trade[]>(draft.trades ?? []);
  const [skills, setSkills] = useState<Skill[]>(draft.skills ?? []);
  const [spoken, setSpoken] = useState<Lang[]>(account.languages ?? [lang]);
  const [prefs, setPrefs] = useState<TermPrefs>(draft.terms ?? {});
  const [where, setWhere] = useState<WorkArea>({
    area: draft.area,
    place: draft.place,
    radius_km: draft.radius_km ?? DEFAULT_RADIUS_KM,
  });
  const [work, setWork] = useState(arrangementsValue(draft.arrangements, draft.other_rates));
  // ADR 0051: only the arrangements that fit the card's work, by its first trade or the worker's own skills. Until the
  // worker ticks one, a trade's card is monthly, as every card was; a card of their own skills alone takes any.
  const offered = cardArrangements({ trades, skills });
  const arranged = offered.length > 1;
  const ownWorkOnly = trades.length === 0;
  const fallback = ownWorkOnly ? [] : [Arrangement.enum.monthly];
  const picked = (work.set ? work.picked : fallback).filter((a) => offered.includes(a));
  const main = arranged ? mainArrangement(picked) : undefined;
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  /** A publish or unlist is on its way: a second tap must not send the card twice. */
  const [busy, setBusy] = useState(false);
  const [unlisting, setUnlisting] = useState(false);
  const rateField = useRef<HTMLInputElement>(null);
  const minField = useRef<HTMLInputElement>(null);
  /** A suggested amount, tapped: put in the field for the worker to keep or change. */
  const fill = (field: typeof rateField) => (paise: number) => {
    if (field.current) field.current.value = rupeesOf(paise);
  };

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // A listed card is when requests start to come: the browser may ask about notifications, once.
    void offerAlerts();
    const v = new FormData(e.currentTarget);
    // Amounts as people type them: "7,000", "₹7000", "७०००", "7k".
    const rate = parseAmount(String(v.get(Field.rate) ?? ""));
    const min = parseAmount(String(v.get(Field.min) ?? ""));
    if (trades.length + skills.length === 0) return setError(t("card.err_trade"));
    const kinds = workRatesIn(v, { trades, skills });
    if (rate === undefined || min === undefined || !(min > 0 && rate >= min) || !kinds)
      return setError(t("card.err_rate"));
    const others = arranged ? otherRates({ ...work, picked }) : {};
    if (!others || (arranged && picked.length === 0 && !ownWorkOnly)) return setError(t("card.err_arrangements"));
    if (busy) return;
    const next: CardDraft = {
      trades,
      ...(skills.length > 0 ? { skills } : {}),
      ...(where.area ? { area: where.area } : {}),
      ...(where.place ? { place: where.place } : {}),
      radius_km: where.radius_km,
      ...(arranged ? { arrangements: picked, other_rates: others } : {}),
      rate_paise: rate,
      limit_paise: min,
      ...kinds,
      languages: spoken,
      about: String(v.get(Field.about) ?? ""),
      asks: asksIn(String(v.get(Field.asks) ?? "")),
      ask_me: askable(trades).filter((k) => v.has(ASK_FIELD + k)),
      auto: v.has(Field.auto),
      terms: prefs,
    };
    setBusy(true);
    try {
      const saved = await publishCard(ports, account, next, lang);
      const pilot = AREAS.find((a) => a.key === next.area);
      setError(undefined);
      setStatus(
        t("card.on_board", {
          trades: cardWork(t, { trades, skills }),
          area: pilot ? t(`area.${pilot.key}`) : (where.place?.name ?? ""),
          price: money(rate),
        }),
      );
      // A card interview left half-way would carry on from the card as it was, and could publish that over this.
      closeInterview();
      onSaved(saved);
    } catch (err) {
      if (err instanceof AboutPrivateError) return setError(t("iv.err_private"));
      log.warn("publish failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  async function unlist() {
    if (busy) return;
    setBusy(true);
    setUnlisting(true);
    try {
      const next = await unlistCard(ports, account);
      setError(undefined);
      setStatus(t("card.off_board"));
      closeInterview();
      onSaved(next);
    } catch (err) {
      log.warn("unlist failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
      setUnlisting(false);
    }
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.card")}</span>
        <h1 className={C.headline}>
          {t("card.headline")} <span className={C.soft}>{t("card.soft")}</span>
        </h1>
        <div className={C.row}>
          <button type={C.button} className={C.secondary} onClick={onTalk}>
            <Icon name="mic" /> {t("iv.by_voice")}
          </button>
        </div>
      </div>
      <form id={FORM_ID} className={C.card} onSubmit={(e) => void publish(e)} aria-label={t("a11y.my_card")}>
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
        <SkillsField
          suggest={(words) => suggestWork(ports.model, words)}
          skills={skills}
          trades={trades}
          onChange={setSkills}
          onTrade={(tr) => setTrades((ts) => [...ts, tr])}
          onFiled={fileWork}
        />
        <AllWork trades={trades} skills={skills} onTrades={setTrades} onSkills={setSkills} />
        <CardRates
          trades={trades}
          area={draft.area}
          place={draft.place}
          session={account.session}
          onRate={fill(rateField)}
          onMin={fill(minField)}
          arrangement={main}
          others={picked.filter((a) => a !== main)}
          onOther={(a, paise) => setWork((w) => ({ ...w, typed: { ...w.typed, [a]: rupeesOf(paise) } }))}
        />
        {arranged && <ArrangementsField offered={offered} value={{ ...work, picked }} onChange={setWork} />}
        <AreaField session={account.session} value={where} onChange={setWhere} />
        <RatesField draft={draft} work={{ trades, skills }} main={main} rateRef={rateField} minRef={minField} />
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.about")}</span>
          <input
            className={C.field}
            name={Field.about}
            maxLength={ABOUT_MAX}
            placeholder={t("card.about_example")}
            defaultValue={draft.about}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.asks")}</span>
          <textarea className={C.field} name={Field.asks} rows={3} defaultValue={draft.asks?.join("\n")} />
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
        <TermPrefsField trades={trades} prefs={prefs} onChange={setPrefs} />
        {askable(trades).map((k) => (
          <label key={k} className={C.checkRow}>
            <input type="checkbox" name={ASK_FIELD + k} defaultChecked={draft.ask_me?.includes(k)} />
            <span className={C.muted}>{t("card.ask_first", { item: t(`detail.${k}`) })}</span>
          </label>
        ))}
        <label className={C.checkRow}>
          <input type="checkbox" name={Field.auto} defaultChecked={draft.auto} />
          <span className={C.muted}>{t("card.auto")}</span>
        </label>
      </form>
      {account.worker && account.listed !== false && (
        <div className={C.row}>
          <button
            type={C.button}
            className={C.quiet}
            disabled={busy}
            aria-busy={unlisting}
            onClick={() => void unlist()}
          >
            {t("card.unlist")}
          </button>
        </div>
      )}
      <Dock>
        <p role="status" aria-live="polite" className={error ? C.dockError : C.dockStatus}>
          {error ?? status}
        </p>
        <button type={C.submit} form={FORM_ID} className={C.wide} disabled={busy} aria-busy={busy && !unlisting}>
          {t("card.publish")}
        </button>
      </Dock>
    </>
  );
}
