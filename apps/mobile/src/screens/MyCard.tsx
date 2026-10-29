import { askable, type CardDraft, CITY_RATES, log, type Ports, parseAmount, rateHint, rateNote } from "@gigsync/core";
import { Lang, PAISE_PER_RUPEE, Trade } from "@gigsync/protocol";
import { type FormEvent, useState } from "react";
import { type Account, apiClient, saveAccount } from "../adapters/account.js";
import { closeInterview } from "../card/interviewStore.js";
import { AboutPrivateError, accountDraft, publishCard } from "../card/publish.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { errorKey } from "../ui/errorKey.js";
import { Icon } from "../ui/Icon.js";
import { AREAS, money } from "../ui/places.js";
import { lineText } from "./talk/Bubbles.js";

/** The form's id, so Publish can sit in the dock, outside it. */
const FORM_ID = "my-card";
const Field = { area: "area", rate: "rate", min: "min", about: "about", auto: "auto" } as const;
const ASK_FIELD = "ask.";
/** What the board keeps of the line about their work. */
const ABOUT_MAX = 300;
const rupeesOf = (paise?: number) => (paise ? String(paise / PAISE_PER_RUPEE) : "");

/**
 * The worker's card, to review and change: the public half goes on the board (name, trades, area, usual rate,
 * languages, a line about their work); the private half stays here (lowest rate, what to see first, signing) and is
 * what their agent negotiates with. The UPI ID is not on the card: payment requests read it from Profile.
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
  const [trades, setTrades] = useState<Trade[]>(draft.trades ?? []);
  const [spoken, setSpoken] = useState<Lang[]>(account.languages ?? [lang]);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  /** A publish or unlist is on its way: a second tap must not send the card twice. */
  const [busy, setBusy] = useState(false);

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  async function publish(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = new FormData(e.currentTarget);
    // Amounts as people type them: "7,000", "₹7000", "७०००", "7k".
    const rate = parseAmount(String(v.get(Field.rate) ?? ""));
    const min = parseAmount(String(v.get(Field.min) ?? ""));
    if (trades.length === 0) return setError(t("card.err_trade"));
    if (rate === undefined || min === undefined || !(min > 0 && rate >= min)) return setError(t("card.err_rate"));
    if (busy) return;
    const next: CardDraft = {
      trades,
      area: String(v.get(Field.area)),
      rate_paise: rate,
      limit_paise: min,
      languages: spoken,
      about: String(v.get(Field.about) ?? ""),
      ask_me: askable(trades).filter((k) => v.has(ASK_FIELD + k)),
      auto: v.has(Field.auto),
    };
    setBusy(true);
    try {
      const saved = await publishCard(ports, account, next, lang);
      const area = AREAS.find((a) => a.key === next.area) ?? AREAS[0];
      setError(undefined);
      setStatus(
        t("card.on_board", {
          trades: trades.map((tr) => t(`trade.${tr}`)).join(", "),
          area: t(`area.${area.key}`),
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
    try {
      await apiClient(account.session).removeProfile();
      const next: Account = { ...account, listed: false };
      await saveAccount(ports, next);
      setError(undefined);
      setStatus(t("card.off_board"));
      closeInterview();
      onSaved(next);
    } catch (err) {
      log.warn("unlist failed", { error: err instanceof Error ? err.message : String(err) });
      setError(t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  const banded = CITY_RATES.bands.some((b) => trades.includes(b.trade));
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
        {trades.flatMap((tr) =>
          rateHint(CITY_RATES, tr).map((line) => (
            <span key={`${tr}.${line.key}`} className={C.faint}>
              {lineText(i18n, line)}
            </span>
          )),
        )}
        {banded && <span className={C.faint}>{t("card.band_use")}</span>}
        {rateNote(CITY_RATES, trades).map((line) => (
          <span key={line.key} className={C.faint}>
            {lineText(i18n, line)}
          </span>
        ))}
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.where")}</span>
          <select className={C.field} name={Field.area} defaultValue={draft.area}>
            {AREAS.map((a) => (
              <option key={a.key} value={a.key}>
                {t(`area.${a.key}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.rate")}</span>
          <input
            className={C.field}
            name={Field.rate}
            inputMode="numeric"
            required
            defaultValue={rupeesOf(draft.rate_paise)}
          />
        </label>
        <label className={C.fieldLabel}>
          <span className={C.muted}>{t("card.min")}</span>
          <input
            className={C.field}
            name={Field.min}
            inputMode="numeric"
            required
            defaultValue={rupeesOf(draft.limit_paise)}
          />
        </label>
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
          <button type={C.button} className={C.quiet} disabled={busy} onClick={() => void unlist()}>
            {t("card.unlist")}
          </button>
        </div>
      )}
      <Dock>
        <p role="status" aria-live="polite" className={error ? C.dockError : C.dockStatus}>
          {error ?? status}
        </p>
        <button type={C.submit} form={FORM_ID} className={C.wide} disabled={busy} aria-busy={busy}>
          {t("card.publish")}
        </button>
      </Dock>
    </>
  );
}
