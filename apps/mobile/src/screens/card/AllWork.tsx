import { cardKinds, kindKey, toggleKind } from "@gigsync/core";
import { GROUP_KINDS, type Skill, type Trade, WorkGroup } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";

/**
 * Every kind of work, by group (ADR 0061), for a worker who is not sure what to list or does more than one thing:
 * tapping a kind puts it on the card, or takes it off. A kind outside the trades goes on as a skill under its own name,
 * and is priced from what its workers list, never from a trade.
 */
export function AllWork({
  trades,
  skills,
  onTrades,
  onSkills,
}: {
  trades: readonly Trade[];
  skills: readonly Skill[];
  onTrades: (trades: Trade[]) => void;
  onSkills: (skills: Skill[]) => void;
}) {
  const { lang, t } = useI18n();
  const on = cardKinds({ trades, skills });
  return (
    <details className="all-work">
      <summary>{t("card.all_work")}</summary>
      {WorkGroup.options.map((group) => (
        <fieldset key={group} className={C.fieldLabel}>
          <legend className={C.muted}>{t(`group.${group}`)}</legend>
          <div className={C.row}>
            {GROUP_KINDS[group].map((kind) => (
              <button
                key={kind}
                type={C.button}
                aria-pressed={on.includes(kind)}
                className={on.includes(kind) ? C.chipOn : C.chip}
                onClick={() => {
                  const work = toggleKind(lang, { trades, skills }, kind);
                  onTrades(work.trades);
                  onSkills(work.skills);
                }}
              >
                {t(kindKey(kind))}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
    </details>
  );
}
