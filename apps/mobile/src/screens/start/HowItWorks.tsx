import type { MessageKey } from "@gigsync/core";
import { useId } from "react";
import { useI18n } from "../../i18n.js";
import { Brand } from "../../ui/Brand.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { Icon, type IconName } from "../../ui/Icon.js";
import "./start.css";

/**
 * What GigSync does for a worker, in three steps that are each true today: the card is made by talking (Talk's card
 * interview), the agent answers households and asks before it signs (it signs alone only if the worker turns that
 * on), and the money comes by UPI straight to the worker, with no cut (ADR 0011).
 */
const STEPS: readonly { icon: IconName; title: MessageKey; sub: MessageKey }[] = [
  { icon: "mic", title: "start.how_say", sub: "start.how_say_sub" },
  { icon: "chat", title: "start.how_agent", sub: "start.how_agent_sub" },
  { icon: "rupee", title: "start.how_paid", sub: "start.how_paid_sub" },
];

/**
 * How it works, shown once to a worker who has no card yet: three steps and one button, which starts the card.
 * `onSkip`, when given, adds a quiet Later under it.
 */
export function HowItWorks({ onDone, onSkip }: { onDone: () => void; onSkip?: () => void }) {
  const { t } = useI18n();
  const id = useId();
  return (
    <section className={`${C.stack} start`} aria-labelledby={id}>
      <Brand />
      <h1 id={id} className={C.headline}>
        {t("start.how_title")}
      </h1>
      <ol className="how-steps">
        {STEPS.map((step, i) => (
          <li key={step.title} className="card how-step">
            <span className="list-row-icon" aria-hidden="true">
              <Icon name={step.icon} size={20} />
            </span>
            <span className="how-words">
              <span className="how-title">
                <span aria-hidden="true">{i + 1} · </span>
                {t(step.title)}
              </span>
              <span className="fine">{t(step.sub)}</span>
            </span>
          </li>
        ))}
      </ol>
      <Dock>
        <div className="start-actions">
          <button type={C.button} className={`${C.wide} btn-big`} onClick={onDone}>
            <Icon name="arrow" size={20} />
            {t("start.how_go")}
          </button>
          {onSkip && (
            <button type={C.button} className="btn ghost" onClick={onSkip}>
              {t("start.later")}
            </button>
          )}
        </div>
      </Dock>
    </section>
  );
}
