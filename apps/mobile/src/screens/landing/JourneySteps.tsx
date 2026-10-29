import {
  advanceStep,
  type ChecklistItem,
  checklist,
  ItemKind,
  type Journey,
  nextStep,
  previousStep,
  stepBack,
  stepProgress,
  TickBy,
  toggleItem,
} from "@gigsync/core";
import { type CityGuide, JourneyStep } from "@gigsync/protocol";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { GuideText, SectionBody } from "./SectionView.js";

interface Props {
  journey: Journey;
  guide: CityGuide;
  onChange: (next: Journey) => void;
}

const CURRENT = "step";

/** One item: a box the owner ticks, and for a guide section, its words to open and read. */
function Item({ item, journey, onChange }: { item: ChecklistItem } & Omit<Props, "guide">) {
  const { t } = useI18n();
  const by = journey.ticked[item.id];
  const box = (
    <label className={C.checkRow}>
      <input type="checkbox" checked={by !== undefined} onChange={() => onChange(toggleItem(journey, item.id))} />
      {item.kind === ItemKind.fixed ? (
        <span>{t(`landing.fixed_${item.item}`)}</span>
      ) : (
        <GuideText text={item.section.title} original={false} />
      )}
    </label>
  );
  return (
    <li className="journey-item">
      {box}
      {by === TickBy.app && <span className={C.muted}>{t("landing.ticked_app")}</span>}
      {item.kind === ItemKind.section && (
        <details>
          <summary className={C.faint}>{t("landing.read")}</summary>
          <SectionBody section={item.section} />
        </details>
      )}
    </li>
  );
}

/**
 * The steps of the move, the one the owner is on marked, and its checklist: the guide's sections for that step and
 * the app's own items. The owner ticks; the next step is theirs to choose, ticked or not.
 */
export function JourneySteps({ journey, guide, onChange }: Props) {
  const { t } = useI18n();
  const steps = JourneyStep.options;
  const at = steps.indexOf(journey.step);
  const { done, total } = stepProgress(guide, journey.step, journey.ticked);
  const next = nextStep(journey.step);
  const back = previousStep(journey.step);
  const stepName = (s: JourneyStep) => t(`landing.step.${s}`);
  return (
    <section className={C.card} aria-label={t("landing.steps")}>
      <ol className="journey-steps">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === at ? CURRENT : undefined} className={i < at ? C.off : undefined}>
            {stepName(s)}
          </li>
        ))}
      </ol>
      <span className={C.label}>{t("landing.step_of", { n: at + 1, total: steps.length })}</span>
      <h2 className={C.title}>{stepName(journey.step)}</h2>
      <span className={C.muted}>{t("landing.done_count", { done, total })}</span>
      <ul className="journey-list">
        {checklist(guide, journey.step).map((item) => (
          <Item key={item.id} item={item} journey={journey} onChange={onChange} />
        ))}
      </ul>
      <div className={C.actions}>
        {next && (
          <button type={C.button} className={C.accent} onClick={() => onChange(advanceStep(journey))}>
            {t("landing.next", { step: stepName(next) })}
          </button>
        )}
        {back && (
          <button type={C.button} className={C.secondary} onClick={() => onChange(stepBack(journey))}>
            {t("landing.back_step", { step: stepName(back) })}
          </button>
        )}
      </div>
    </section>
  );
}
