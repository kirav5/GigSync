import { type MessageKey, type NeedState, needEstimate } from "@gigsync/core";
import { PAISE_PER_RUPEE, RateUnit } from "@gigsync/protocol";
import { useState } from "react";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { EstimateBand } from "../estimate/EstimateBand.js";
import { Choices, type ChoicesProps } from "./Choices.js";

/** What an estimate's amounts are per, in words, where the app has words for it ("a visit"); else the amount alone. */
const UNIT_WORDS: Readonly<Partial<Record<RateUnit, MessageKey>>> = {
  [RateUnit.enum.hour]: "unit.hour",
  [RateUnit.enum.visit]: "unit.visit",
  [RateUnit.enum.week]: "unit.week",
  [RateUnit.enum.month]: "unit.month",
};

/** How far one step of the budget slider moves, in rupees, by what the amount is per: an hour in ₹10, a month in ₹500. */
const STEP_RUPEES: Readonly<Record<RateUnit, number>> = {
  [RateUnit.enum.hour]: 10,
  [RateUnit.enum.visit]: 50,
  [RateUnit.enum.day]: 50,
  [RateUnit.enum.job]: 50,
  [RateUnit.enum.week]: 100,
  [RateUnit.enum.month]: 500,
  [RateUnit.enum.sqft]: 1,
};

/**
 * The composer is a ui primitive with no handle to give out: its one text field is found on the page and focused, so
 * "I'll say it" puts the owner straight at the mic and the number pad.
 */
const COMPOSER_FIELD = "form.composer input";
const focusComposer = () => document.querySelector<HTMLInputElement>(COMPOSER_FIELD)?.focus();

/**
 * Under the budget question, when the job has an estimate (ADR 0030 §5): its usual range drawn as a band the owner slides
 * along, from the typical amount, and "Use ₹X" to send the amount slid to; then the low end, the agent's suggestion (the
 * core's "Use ₹X") and the high end as amounts to tap, and "I'll say it". The lines in the
 * bubble above still say it all in words. A tapped amount is sent as typed, so it is never read aloud, and it stays on
 * the phone like any budget; nothing is filled in until the owner taps. Without an estimate, the chips alone.
 */
export function BudgetCard({
  state,
  onSay,
  ...props
}: ChoicesProps & { state: NeedState; onSay: (text: string) => void }) {
  const { t } = useI18n();
  const found = needEstimate(state);
  const [picked, setPicked] = useState<number | undefined>();
  if (!found) return <Choices {...props} />;
  const { low_paise, typical_paise, high_paise, unit } = found.estimate;
  const chosen = picked ?? typical_paise;
  const words = UNIT_WORDS[unit];
  const amount = (paise: number) => (
    <button type={C.button} className={C.chip} onClick={() => onSay(money(paise))}>
      {money(paise)}
    </button>
  );
  return (
    <>
      <div className={`${C.card} budget-card`}>
        <EstimateBand
          low={low_paise}
          typical={typical_paise}
          high={high_paise}
          unit={words && t(words)}
          caption={t("find.band_caption")}
          pick={{
            value: chosen,
            step: STEP_RUPEES[unit] * PAISE_PER_RUPEE,
            label: t("find.band_label"),
            onChange: setPicked,
          }}
        />
        <button type={C.button} className={C.wide} onClick={() => onSay(money(chosen))}>
          {t("find.band_use", { amount: money(chosen) })}
        </button>
      </div>
      <Choices
        {...props}
        lead={amount(low_paise)}
        tail={
          <>
            {amount(high_paise)}
            <button type={C.button} className={C.chip} onClick={focusComposer}>
              {t("find.say_it")}
            </button>
          </>
        }
      />
    </>
  );
}
