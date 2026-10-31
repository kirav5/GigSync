import { type MessageKey, type RecordMonth, type RecordRow, RecordState, type WorkRecord } from "@gigsync/core";
import { useId } from "react";
import { type I18n, useI18n } from "../../i18n.js";
import { money } from "../../ui/places.js";
import { type CardProps, type OpenRow, RecordLine } from "./RecordLine.js";
import { type Chip, monthText, Tag, weekdayText, whoOf } from "./text.js";
import "./record.css";

/** Each money state's words and look. */
const CHIP: Readonly<Record<RecordState, { text: MessageKey; cls: Tag }>> = {
  [RecordState.received]: { text: "record.state_received", cls: Tag.fresh },
  [RecordState.cash]: { text: "record.state_cash", cls: Tag.fresh },
  [RecordState.waiting]: { text: "record.state_waiting", cls: Tag.wait },
  [RecordState.notAsked]: { text: "record.state_not_asked", cls: Tag.talk },
  [RecordState.cancelled]: { text: "record.state_cancelled", cls: Tag.plain },
};

type Props = CardProps & OpenRow & { record: WorkRecord };

/** The chip's words: the amount that came, for money received. */
function chipOf(t: I18n["t"], row: RecordRow): Chip {
  const { text, cls } = CHIP[row.state];
  return { text: t(text, { price: money(row.payment?.amount_paise ?? row.price_paise) }), cls };
}

/** How money that came was paid (the chip says cash itself), and the UPI reference whenever the payer gave one. */
function factsOf(t: I18n["t"], row: RecordRow): string[] {
  const p = row.payment;
  if (!p) return [];
  const facts = row.state === RecordState.received ? [t(`method.${p.method}`)] : [];
  return p.utr ? [...facts, t("payrow.ref", { utr: p.utr })] : facts;
}

/**
 * The worker's completed work: how many jobs, for how many households, since when (no day counts, no claims beyond
 * the jobs themselves), then every completed job by month, newest first.
 */
export function WorkDone({ record, ...rows }: Props) {
  const { lang, t, plural } = useI18n();
  const heading = useId();
  const { since } = record;
  return (
    <>
      {since && (
        <p className="record-summary">
          {plural("record.jobs", record.jobs)} · {plural("record.households", record.households)} ·{" "}
          {t("record.since", { month: monthText(lang, since) })}
        </p>
      )}
      <section className="record" aria-labelledby={heading}>
        <h2 id={heading}>{t("record.title")}</h2>
        {record.months.map((m) => (
          <Month key={m.month} {...m} {...rows} />
        ))}
      </section>
    </>
  );
}

/** One month's heading, in the owner's language, over its jobs. */
function Month({ month, rows, openId, onToggle, ...card }: RecordMonth & CardProps & OpenRow) {
  const { lang, t } = useI18n();
  const heading = useId();
  return (
    <div className="record-month">
      <h3 id={heading}>{monthText(lang, month)}</h3>
      <ul className="record-list" aria-labelledby={heading}>
        {rows.map((row) => {
          const id = row.job.engagement.id;
          return (
            <RecordLine
              key={id}
              job={row.job}
              when={weekdayText(lang, row.day)}
              who={whoOf(row.job, card.view.names, t("job.customer"))}
              price={row.price_paise}
              chip={chipOf(t, row)}
              facts={factsOf(t, row)}
              open={openId === id}
              onToggle={() => onToggle(id)}
              {...card}
            />
          );
        })}
      </ul>
    </div>
  );
}
