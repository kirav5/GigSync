import { type BoardWorker, Lang } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { areaLabel, money } from "../../ui/places.js";
import { Said } from "../../ui/Said.js";

/** The language a worker writes their card in: the first one they listed that the app knows. */
const cardLang = (w: BoardWorker) => w.languages.map((l) => Lang.safeParse(l)).find((p) => p.success)?.data;

/**
 * One worker from the board as Find lists them, with the box that picks them to ask. Their "about" line is in the
 * reader's language.
 */
export function WorkerPick({
  worker: w,
  picked,
  onToggle,
}: {
  worker: BoardWorker;
  picked: boolean;
  onToggle: () => void;
}) {
  const { lang, t } = useI18n();
  /** A listed language, named in the owner's language when the app knows it, else its code. */
  const languageName = (code: string) => {
    const known = Lang.safeParse(code);
    return known.success ? t(`lang.${known.data}`) : code;
  };
  return (
    <label className={C.card} aria-label={t("a11y.worker", { name: w.display_name })}>
      <div className={C.row}>
        <input
          type="checkbox"
          aria-label={t("a11y.ask_worker", { name: w.display_name })}
          checked={picked}
          onChange={onToggle}
        />
        <span className="avatar" aria-hidden="true">
          {w.display_name.slice(0, 1).toUpperCase()}
        </span>
        <div className="who">
          <strong>{w.display_name}</strong>
          <span className={C.muted}>
            {w.trades.map((tr) => t(`trade.${tr}`)).join(", ")} · {areaLabel(lang, w.area_name)} ·{" "}
            {t("find.distance", { km: w.distance_km })}
          </span>
          {w.languages.length > 0 && <span className={C.faint}>{w.languages.map(languageName).join(", ")}</span>}
        </div>
        <span className={`${C.money} end`}>{t("find.from", { price: money(w.rate_paise) })}</span>
      </div>
      {w.about && (
        <span className={C.faint}>
          <Said text={w.about} from={cardLang(w)} />
        </span>
      )}
    </label>
  );
}
