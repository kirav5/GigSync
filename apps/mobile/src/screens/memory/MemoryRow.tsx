import { type Asked, type MemoryItem, MemoryItemKind, type Person } from "@gigsync/core";
import { QuestionKey } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { money } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";
import { DetailValue } from "../DetailValue.js";
import { areaAt } from "./owner.js";

const K = MemoryItemKind;
/** A remembered place outside the pilot's areas is shown as its point, to this many decimals (about 100 m). */
const PLACE_DECIMALS = 3;

/** A remembered day, `YYYY-MM-DD`, as a date in the owner's language. */
function useDay() {
  const { date } = useI18n();
  return (on: string) => date(new Date(on));
}

function PersonLines({ person }: { person: Person }) {
  const { t, plural } = useI18n();
  const day = useDay();
  const details = QuestionKey.options.flatMap((key) => {
    const d = person.details[key];
    return d ? [[key, d.value] as const] : [];
  });
  return (
    <>
      <strong>{person.name ?? t("memory.unnamed")}</strong>
      <span className={C.muted}>
        {person.trades.map((tr) => t(`trade.${tr}`)).join(", ")} · {plural("memory.jobs", person.jobs)} ·{" "}
        {t("memory.last_on", { date: day(person.last_on) })}
      </span>
      {person.last_price_paise !== undefined && (
        <span className={C.muted}>{t("memory.last_price", { price: money(person.last_price_paise) })}</span>
      )}
      {details.length > 0 && <span className={C.faint}>{t("memory.they_said")}</span>}
      {details.length > 0 && (
        <span className={C.muted}>
          {details.map(([key, value], i) => (
            <span key={key}>
              {i > 0 && "; "}
              {t(`detail.${key}`)} <DetailValue value={value} from={person.lang} />
            </span>
          ))}
        </span>
      )}
    </>
  );
}

function AskedLine({ asked }: { asked: Asked }) {
  const { t } = useI18n();
  const standard = QuestionKey.safeParse(asked.key);
  if (asked.text) return <Said text={asked.text} from={asked.lang} />;
  return <>{standard.success ? t(`question.${standard.data}`) : asked.key}</>;
}

/** What one remembered item says, in the owner's language. */
function ItemBody({ item }: { item: MemoryItem }) {
  const { t } = useI18n();
  const day = useDay();
  switch (item.kind) {
    case K.fact:
      return (
        <>
          <strong>{t(`detail.${item.fact}`)}</strong>
          <span>
            <DetailValue value={item.value} from={undefined} /> · <span className={C.faint}>{day(item.on)}</span>
          </span>
        </>
      );
    case K.area: {
      const area = areaAt(item.place);
      const where = area
        ? t(`area.${area.key}`)
        : `${item.place.lat.toFixed(PLACE_DECIMALS)}, ${item.place.lon.toFixed(PLACE_DECIMALS)}`;
      return (
        <>
          <strong>{t("memory.area")}</strong>
          <span>{where}</span>
        </>
      );
    }
    case K.person:
      return <PersonLines person={item.person} />;
    case K.asked:
      return (
        <>
          <strong>{t("memory.asked", { trade: t(`trade.${item.trade}`) })}</strong>
          <ul className="memory-asked">
            {item.asked.map((a) => (
              <li key={a.text ?? a.key} className={C.muted}>
                <AskedLine asked={a} />
              </li>
            ))}
          </ul>
        </>
      );
  }
}

/** One line of "What my agent remembers", with its Forget. */
export function MemoryRow({ item, onForget }: { item: MemoryItem; onForget: (key: string) => void }) {
  const { t } = useI18n();
  return (
    <li className="memory-row" data-memory={item.key}>
      <span className="memory-what">
        <ItemBody item={item} />
      </span>
      <button type={C.button} className={C.quiet} onClick={() => onForget(item.key)}>
        {t("memory.forget")}
      </button>
    </li>
  );
}
