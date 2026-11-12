import { GENERAL_STEPS, NATIONAL_LINES } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { Icon } from "../../ui/Icon.js";
import { ListCard } from "../../ui/ListRow.js";

const TEL = "tel:";

/**
 * A city with no guide (or "Somewhere else"): there is no journey to start, so this says so and gives what helps in any
 * city, as Talk does for such a move: the app's own checklist items and the numbers that work anywhere in India.
 */
export function NoGuideCity() {
  const { t } = useI18n();
  return (
    <>
      <p>{t("me.move_no_guide")}</p>
      <ul className="tick-list">
        {GENERAL_STEPS.map((step) => (
          <li key={step}>{t(`landing.fixed_${step}`)}</li>
        ))}
      </ul>
      <ListCard label={t("moving.lines")}>
        {NATIONAL_LINES.map((line) => (
          <a
            key={line.number}
            className="list-row"
            href={TEL + line.number}
            aria-label={t("landing.call", { name: t(`moving.line.${line.name}`), number: line.number })}
          >
            <span className="list-row-icon">
              <Icon name="call" size={20} />
            </span>
            <span className="list-row-text">
              <span className="list-row-title">{t(`moving.line.${line.name}`)}</span>
              <span className="list-row-sub">{line.number}</span>
            </span>
          </a>
        ))}
      </ListCard>
    </>
  );
}
