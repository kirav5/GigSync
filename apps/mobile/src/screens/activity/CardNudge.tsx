import { useI18n } from "../../i18n.js";
import { CardState } from "../../state.js";
import { C } from "../../ui/cls.js";

interface Props {
  card: CardState;
  /** Opens Talk with the card interview. */
  onMakeCard: () => void;
  /** Opens My card, where it goes back on the board. */
  onOpenCard: () => void;
}

/** While the worker has no card, or theirs is off the board: households near them cannot find them. */
export function CardNudge({ card, onMakeCard, onOpenCard }: Props) {
  const { t } = useI18n();
  if (card === CardState.none)
    return (
      <div className={C.card}>
        <span>{t("home.no_card")}</span>
        <div className={C.actions}>
          <button type={C.button} className={C.accent} onClick={onMakeCard}>
            {t("home.make_card")}
          </button>
        </div>
      </div>
    );
  if (card === CardState.off)
    return (
      <div className={C.card}>
        <span>{t("home.card_off")}</span>
        <div className={C.actions}>
          <button type={C.button} className={C.secondary} onClick={onOpenCard}>
            {t("nav.card")}
          </button>
        </div>
      </div>
    );
  return null;
}
