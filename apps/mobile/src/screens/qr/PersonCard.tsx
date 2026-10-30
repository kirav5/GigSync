import { type BoardProfile, Lang } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { areaLabel, money } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";

/** The language a worker writes their card in: the first one they listed that the app knows. */
const cardLang = (card: BoardProfile) => card.languages.map((l) => Lang.safeParse(l)).find((p) => p.success)?.data;

/** A worker's board card as a QR or an offer shows it: name, trades, area, usual rate, languages, their line. */
export function WorkerCard({ card }: { card: BoardProfile }) {
  const { lang, t } = useI18n();
  const languageName = (code: string) => {
    const known = Lang.safeParse(code);
    return known.success ? t(`lang.${known.data}`) : code;
  };
  return (
    <div className={C.stack}>
      <div className={C.row}>
        <Initial name={card.display_name} />
        <div className="who">
          <strong>{card.display_name}</strong>
          <span className={C.muted}>
            {card.trades.map((tr) => t(`trade.${tr}`)).join(", ")} · {areaLabel(lang, card.area_name)}
          </span>
          {card.languages.length > 0 && <span className={C.faint}>{card.languages.map(languageName).join(", ")}</span>}
        </div>
        <span className={`${C.money} end`}>{t("find.from", { price: money(card.rate_paise) })}</span>
      </div>
      {card.about && (
        <span className={C.faint}>
          <Said text={card.about} from={cardLang(card)} />
        </span>
      )}
    </div>
  );
}

/** A person's first letter in the accent square, as Find shows workers. */
export function Initial({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
