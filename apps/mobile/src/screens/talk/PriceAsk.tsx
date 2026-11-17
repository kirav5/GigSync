import {
  AMOUNT_STEP_PAISE,
  type InterviewState,
  nearYouLine,
  type PriceRate,
  priceArrangements,
  pricePicked,
  priceUnit,
  suggestedAmount,
} from "@gigsync/core";
import { Arrangement, ISO_WEEKDAYS, type IsoWeekday, mainArrangement } from "@gigsync/protocol";
import { type RefObject, useEffect, useRef, useState } from "react";
import { priceInterview, tapInterview, toggleInterview } from "../../card/interviewStore.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { money, rupeesOf } from "../../ui/places.js";
import { AmountDial, PICKED, paiseIn } from "../card/AmountDial.js";
import { lineText } from "./Bubbles.js";
import { DayPick, PartPick } from "./WhenPick.js";

/** Between the parts of the owner's answer as it reads in the chat: "₹450 / visit, ₹4,500 / month · Mon, Tue · Morning". */
const PART_JOINER = " · ";
const DAY_JOINER = ", ";
/** The lock beside "Stays on this phone", the size of its words. */
const PRIVATE_ICON_PX = 16;
/** The tick in a way that is on, the size of its words. */
const TICK_PX = 14;
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

/** A way of taking the work, for its amount's field; work priced one way has none. */
type Way = Arrangement | undefined;
/** The field of work priced one way, in the map of the card's amount fields. */
const ONE_WAY = "one";
const keyOf = (way: Way): string => way ?? ONE_WAY;

/**
 * One way's amount: big when it is the card's only one, smaller in a stack of several. The main way opens at the
 * suggestion (the estimate is for it); another at the rate it already has, if any.
 */
function WayAmount({
  state,
  way,
  main,
  compact,
  fields,
}: {
  state: InterviewState;
  way: Way;
  main: boolean;
  compact: boolean;
  fields: RefObject<Map<string, HTMLInputElement | null>>;
}) {
  const { t } = useI18n();
  const { draft } = state;
  const field = useRef<HTMLInputElement>(null);
  const known = main ? (draft.rate_paise ?? suggestedAmount(state, false)) : way && draft.other_rates?.[way];
  const touch = useSuggested(field, known);
  useEffect(() => {
    const all = fields.current;
    all.set(keyOf(way), field.current);
    return () => {
      all.delete(keyOf(way));
    };
  }, [fields, way]);
  const per = way && t(`cardflow.per.${way}`);
  return (
    <AmountDial
      label={compact && per ? t("cardflow.amount_per", { per }) : t("cardflow.amount")}
      step={way ? AMOUNT_STEP_PAISE[way] : PLAIN_STEP}
      unit={per}
      compact={compact}
      inputRef={field}
      onAmount={touch}
    />
  );
}

/** The ways the work can be taken, as the kit's chips with a tick when on: as many as they work, at least one. */
function WayPick({ ways, picked }: { ways: readonly Arrangement[]; picked: readonly Arrangement[] }) {
  const { t } = useI18n();
  return (
    <fieldset className="price-when" aria-label={t("cardflow.ways")}>
      <span className="price-label">{t("cardflow.ways")}</span>
      <div className="price-parts price-ways">
        {ways.map((a) => {
          const on = picked.includes(a);
          return (
            <button
              key={a}
              type={C.button}
              aria-pressed={on}
              className={on ? PICKED : undefined}
              onClick={() => toggleInterview(a)}
            >
              <span>
                {on && <Icon name="tick" size={TICK_PX} />}
                {t(`cardflow.seg.${a}`)}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * "Your price" under the usual-rate question (the design's board 10): each way the work is taken, ticked, with an
 * amount to type or step for each; the going rate near them in one line; the days and the part of the day; and one
 * button that answers it all. Typing an amount in the composer still answers the question; the card is the way most
 * will.
 */
export function PriceAsk({ state }: { state: InterviewState }) {
  const i18n = useI18n();
  const { t } = i18n;
  const { draft } = state;
  const prefs = draft.terms ?? {};
  const [days, setDays] = useState<IsoWeekday[]>(prefs.days?.length ? prefs.days : [...ISO_WEEKDAYS]);
  const [part, setPart] = useState(prefs.windows?.length === 1 ? prefs.windows[0] : undefined);
  const fields = useRef(new Map<string, HTMLInputElement | null>());
  const ways = priceArrangements(draft);
  const picked = pricePicked(draft);
  const shown: Way[] = ways.length > 1 ? picked : [priceUnit(draft)];
  const main = mainArrangement(picked);
  const near = nearYouLine(state);
  const send = () => {
    const rates: PriceRate[] = [];
    for (const way of shown) {
      const field = fields.current.get(keyOf(way)) ?? null;
      const paise = paiseIn(field);
      if (!paise) return field?.focus();
      rates.push({ arrangement: way, paise });
    }
    const every = days.length === 0 || days.length === ISO_WEEKDAYS.length;
    const named = ISO_WEEKDAYS.filter((d) => days.includes(d)).map((d) => t(`day.${d}`));
    const said = rates.map((r) =>
      [money(r.paise), r.arrangement && t(`cardflow.per.${r.arrangement}`)].filter(Boolean),
    );
    const priced = said.map((words) => words.join(" ")).join(DAY_JOINER);
    const label = [priced, every ? "" : named.join(DAY_JOINER), part ? t(`cardflow.window.${part}`) : ""];
    priceInterview({ rates, days, window: part }, label.filter(Boolean).join(PART_JOINER));
  };
  return (
    <div className={`${C.card} price-card`}>
      <h3 className="price-title">{t("cardflow.price_title")}</h3>
      {ways.length > 1 && <WayPick ways={ways} picked={picked} />}
      <div className="price-amounts">
        {shown.map((way) => (
          <WayAmount
            key={keyOf(way)}
            state={state}
            way={way}
            main={shown.length === 1 || way === main}
            compact={shown.length > 1}
            fields={fields}
          />
        ))}
      </div>
      {near && <p className="near-you">{lineText(i18n, near)}</p>}
      <DayPick days={days} onDays={setDays} />
      <PartPick part={part} onPart={setPart} />
      <button type={C.button} className={C.wide} onClick={send}>
        {t(shown.length > 1 ? "cardflow.prices_next" : "cardflow.price_next")}
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
