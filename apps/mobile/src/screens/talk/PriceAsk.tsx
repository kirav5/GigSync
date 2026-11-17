import {
  AMOUNT_STEP_PAISE,
  type InterviewState,
  nearYouLine,
  priceArrangements,
  priceUnit,
  suggestedAmount,
} from "@gigsync/core";
import { Arrangement, ISO_WEEKDAYS, type IsoWeekday } from "@gigsync/protocol";
import { type RefObject, useEffect, useRef, useState } from "react";
import { priceInterview, tapInterview, toggleInterview } from "../../card/interviewStore.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { money, rupeesOf } from "../../ui/places.js";
import { AmountDial, paiseIn, Segmented } from "../card/AmountDial.js";
import { lineText } from "./Bubbles.js";
import { DayPick, PartPick } from "./WhenPick.js";

/** Between the parts of the owner's answer as it reads in the chat: "₹4,500 / month · Mon, Tue · Morning". */
const PART_JOINER = " · ";
const DAY_JOINER = ", ";
/** The lock beside "Stays on this phone", the size of its words. */
const PRIVATE_ICON_PX = 16;
/** A price with no unit of its own (work of their own, not yet priced by any arrangement) steps as a visit's. */
const PLAIN_STEP = AMOUNT_STEP_PAISE[Arrangement.enum.visit];

/**
 * The amount field's opening value, kept in step with the suggestion until the owner types or steps it: the estimate
 * arrives after the card, and a segment tapped brings another unit's.
 */
function useSuggested(field: RefObject<HTMLInputElement | null>, suggested: number | undefined) {
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current || !field.current) return;
    field.current.value = rupeesOf(suggested);
  }, [field, suggested]);
  return () => {
    touched.current = true;
  };
}

/**
 * "Your price" under the usual-rate question (the design's board 10): how the work is priced, one big amount to type or
 * step, the going rate near them in one line, the days and the part of the day, and one button that answers it all.
 * Typing an amount in the composer still answers the question; the card is the way most will.
 */
export function PriceAsk({ state }: { state: InterviewState }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { draft } = state;
  const prefs = draft.terms ?? {};
  const [days, setDays] = useState<IsoWeekday[]>(prefs.days?.length ? prefs.days : [...ISO_WEEKDAYS]);
  const [part, setPart] = useState(prefs.windows?.length === 1 ? prefs.windows[0] : undefined);
  const field = useRef<HTMLInputElement>(null);
  const touch = useSuggested(field, draft.rate_paise ?? suggestedAmount(state, false));
  const unit = priceUnit(draft);
  const per = unit && t(`cardflow.per.${unit}`);
  const near = nearYouLine(state);
  const segments = priceArrangements(draft).map((a) => ({ value: a, label: t(`cardflow.seg.${a}`) }));
  const send = () => {
    const paise = paiseIn(field.current);
    if (!paise) return field.current?.focus();
    const every = days.length === 0 || days.length === ISO_WEEKDAYS.length;
    const named = ISO_WEEKDAYS.filter((d) => days.includes(d)).map((d) => t(`day.${d}`));
    const said = [[money(paise), per].filter(Boolean).join(" "), every ? "" : named.join(DAY_JOINER)];
    const label = [...said, part ? t(`cardflow.window.${part}`) : ""].filter(Boolean).join(PART_JOINER);
    priceInterview({ arrangement: unit, paise, days, window: part }, label);
  };
  return (
    <div className={`${C.card} price-card`}>
      <h3 className="price-title">{t("cardflow.price_title")}</h3>
      {segments.length > 1 && (
        <Segmented label={t("card.arrangements")} options={segments} value={unit} onPick={toggleInterview} />
      )}
      <AmountDial
        label={t("cardflow.amount")}
        step={unit ? AMOUNT_STEP_PAISE[unit] : PLAIN_STEP}
        unit={per}
        inputRef={field}
        onAmount={touch}
      />
      {near && <p className="near-you">{lineText(i18n, near)}</p>}
      <DayPick days={days} onDays={setDays} />
      <PartPick part={part} onPart={setPart} />
      <button type={C.button} className={C.wide} onClick={send}>
        {t("cardflow.price_next")}
      </button>
    </div>
  );
}

/** The least they take, private: its title, one amount, "Stays on this phone" quietly under it, and the button. Typed in the composer works too. */
export function LowestAsk({ state }: { state: InterviewState }) {
  const { t } = useI18n();
  const field = useRef<HTMLInputElement>(null);
  const touch = useSuggested(field, state.draft.limit_paise ?? suggestedAmount(state, true));
  const unit = priceUnit(state.draft);
  const send = () => {
    const paise = paiseIn(field.current);
    if (!paise) return field.current?.focus();
    tapInterview(String(paise), money(paise));
  };
  return (
    <div className={`${C.card} price-card`}>
      <h3 className="price-title">{t("cardflow.lowest_title")}</h3>
      <AmountDial
        label={t("cardflow.lowest_title")}
        step={unit ? AMOUNT_STEP_PAISE[unit] : PLAIN_STEP}
        unit={unit && t(`cardflow.per.${unit}`)}
        inputRef={field}
        onAmount={touch}
      />
      <p className="price-private">
        <Icon name="lock" size={PRIVATE_ICON_PX} />
        {t("cardflow.private")}
      </p>
      <button type={C.button} className={C.wide} onClick={send}>
        {t("cardflow.lowest_next")}
      </button>
    </div>
  );
}
