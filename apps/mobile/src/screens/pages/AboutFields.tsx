import { useId } from "react";
import type { Account } from "../../adapters/account.js";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";
import { cardWork } from "../../ui/work.js";
import { workAreaName } from "../me/WorkAreaPage.js";

/** Between the languages a worker speaks. */
const LIST = ", ";
/** The id of a field's value, after the id of its label. */
const VALUE = "v";

/**
 * One of the card's facts drawn as the design's form field: its label over a box holding the value. The box is a button
 * that opens the card's form, where the fact is changed, so the form is not drawn twice; its name is the label.
 */
function CardField({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }) {
  const id = useId();
  return (
    <div className="about-field">
      <span id={id} className={C.label}>
        {label}
      </span>
      <button
        type={C.button}
        className="field about-field-box"
        aria-labelledby={id}
        aria-describedby={id + VALUE}
        onClick={onOpen}
      >
        <span id={id + VALUE}>{value}</span>
        <Icon name="pencil" size={16} />
      </button>
    </div>
  );
}

/**
 * About me's work, area and distance, and languages, as the worker's card holds them (design P2). Each opens the card's
 * form; before there is a card, each says so and opens the form to make one.
 */
export function AboutFields({
  account,
  onEditCard,
  onEditArea,
}: {
  account: Account;
  onEditCard: () => void;
  /** The area opens its own page, with the map and the distance. */
  onEditArea: () => void;
}) {
  const { t } = useI18n();
  const rules = account.worker;
  const none = t("me.not_on_card");
  const area = workAreaName(account, t);
  const langs = (account.languages ?? []).map((l) => t(`lang.${l}`)).join(LIST);
  return (
    <div className={C.stack}>
      <CardField label={t("me.work")} value={rules ? cardWork(t, rules) : none} onOpen={onEditCard} />
      <CardField
        label={t("me.area")}
        value={rules && area ? t("me.area_km", { area, km: rules.radius_km }) : none}
        onOpen={rules ? onEditArea : onEditCard}
      />
      <CardField label={t("me.languages")} value={langs || none} onOpen={onEditCard} />
    </div>
  );
}
