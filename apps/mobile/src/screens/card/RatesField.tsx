import { AMOUNT_STEP_PAISE, type CardDraft, cardWorks, parseAmount, type WorkId, workNameOf } from "@gigsync/core";
import { Arrangement, type Skill, type Trade } from "@gigsync/protocol";
import type { RefObject } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { rupeesOf } from "../../ui/places.js";
import { AmountDial } from "./AmountDial.js";

/** The form's names for the rate fields; each other kind's are these with its id after. */
/** Amounts are typed on the number pad. */
const NUMERIC = "numeric";

export const RateField = { rate: "rate", min: "min", work: "work_rate.", lowest: "work_limit." } as const;

interface Work {
  trades: readonly Trade[];
  skills: readonly Skill[];
}

/** What the form says of each other kind (ADR 0062); undefined when an amount is not one, or a lowest is above it. */
export function workRatesIn(
  form: FormData,
  work: Work,
): Pick<CardDraft, "same_rate" | "work_rates" | "work_limits"> | undefined {
  const work_rates: Partial<Record<WorkId, number>> = {};
  const work_limits: Partial<Record<WorkId, number>> = {};
  for (const id of cardWorks(work).slice(1)) {
    const usualText = String(form.get(RateField.work + id) ?? "").trim();
    const lowestText = String(form.get(RateField.lowest + id) ?? "").trim();
    // A kind left blank is at the card's rate.
    if (!usualText) continue;
    const usual = parseAmount(usualText);
    const lowest = lowestText ? parseAmount(lowestText) : undefined;
    if (usual === undefined || usual <= 0 || (lowestText && (lowest === undefined || lowest <= 0 || lowest > usual)))
      return undefined;
    work_rates[id] = usual;
    if (lowest !== undefined) work_limits[id] = lowest;
  }
  if (Object.keys(work_rates).length === 0) return { same_rate: true };
  return { same_rate: false, work_rates, work_limits };
}

/**
 * The usual rate and the lowest, for the card's first kind (or its main arrangement), then, for a card with more
 * kinds, a usual rate and a lowest for each other one: left blank, it is at the card's rate. The lowest rates stay on
 * the phone.
 */
export function RatesField({
  draft,
  work,
  main,
  rateRef,
  minRef,
}: {
  draft: CardDraft;
  work: Work;
  main: Arrangement | undefined;
  rateRef: RefObject<HTMLInputElement | null>;
  minRef: RefObject<HTMLInputElement | null>;
}) {
  const { t } = useI18n();
  const others = cardWorks(work).slice(1);
  const nameOf = (id: WorkId) => {
    const name = workNameOf(work, id);
    if (!name) return "";
    return "trade" in name ? t(`trade.${name.trade}`) : name.text;
  };
  const own = draft.same_rate === false;
  const rateLabel = t(main ? `card.rate.${main}` : "card.rate");
  // The same amount as the card chat's (PriceAsk.tsx): typed, or stepped with − and +.
  const step = AMOUNT_STEP_PAISE[main ?? Arrangement.enum.visit];
  const per = main && t(`cardflow.per.${main}`);
  return (
    <>
      <div className={C.fieldLabel}>
        <span className={C.muted}>{rateLabel}</span>
        <AmountDial
          label={rateLabel}
          name={RateField.rate}
          inputRef={rateRef}
          required
          initial={draft.rate_paise}
          step={step}
          unit={per}
        />
      </div>
      <div className={C.fieldLabel}>
        <span className={C.muted}>{t("card.min")}</span>
        <AmountDial
          label={t("card.min")}
          name={RateField.min}
          inputRef={minRef}
          required
          initial={draft.limit_paise}
          step={step}
          unit={per}
        />
      </div>
      {others.length > 0 && (
        <fieldset className={C.stack} aria-label={t("card.work_rates")}>
          <span className={C.label}>{t("card.work_rates")}</span>
          {others.map((id) => (
            <div key={id} className={C.row}>
              <label className={C.fieldLabel}>
                <span className={C.muted}>{t("card.work_rate", { work: nameOf(id) })}</span>
                <input
                  className={C.field}
                  name={RateField.work + id}
                  inputMode={NUMERIC}
                  defaultValue={own ? rupeesOf(draft.work_rates?.[id]) : ""}
                />
              </label>
              <label className={C.fieldLabel}>
                <span className={C.muted}>{t("card.work_limit", { work: nameOf(id) })}</span>
                <input
                  className={C.field}
                  name={RateField.lowest + id}
                  inputMode={NUMERIC}
                  defaultValue={own ? rupeesOf(draft.work_limits?.[id]) : ""}
                />
              </label>
            </div>
          ))}
        </fieldset>
      )}
    </>
  );
}
