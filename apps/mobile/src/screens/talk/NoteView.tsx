import { type Card, CardKind, type ChatIntent, type MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Said } from "../../ui/Said.js";
import { Own } from "./Bubbles.js";

/**
 * A note to the agent in Talk and what came of it: the agent's card once it has answered, three pulsing dots while it
 * is still working on it (the phone's model can take seconds), and, when it could not tell what the owner meant, its
 * question with one choice per meaning (ADR 0042 amendment 2026-11-03).
 */

/** The heading each card kind gets on screen. */
const KIND_LABEL: Readonly<Record<Card["kind"], MessageKey>> = {
  [CardKind.text]: "card.text",
  [CardKind.saved]: "card.saved",
  [CardKind.answer]: "card.answer",
  [CardKind.draft]: "card.draft",
  [CardKind.needsModel]: "card.needs_model",
  [CardKind.clarify]: "card.clarify",
};

/** A card's words: a phrase in the owner's language, or quoted words translated on the phone when needed. */
function CardText({ card }: { card: Card }) {
  const { t } = useI18n();
  if ("say" in card) return <>{t(card.say.key, card.say.params)}</>;
  return <Said text={card.words.text} from={card.words.lang} />;
}

/** The agent at work: dots that pulse (still, where the owner asked for less motion) and the words for it. */
export function Thinking() {
  const { t } = useI18n();
  return (
    <div className="msg-agent thinking" role="status">
      <span className="thinking-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className={C.faint}>{t("agent.thinking")}</span>
    </div>
  );
}

/** One button per meaning the agent was torn between, "Something else" last. */
function Choices({ choices, onChoose }: { choices: readonly ChatIntent[]; onChoose: (intent: ChatIntent) => void }) {
  const { t } = useI18n();
  return (
    <div className={`${C.row} iv-choices`}>
      {choices.map((intent) => (
        <button key={intent} type={C.button} className={C.chip} onClick={() => onChoose(intent)}>
          {t(`choose.${intent}`)}
        </button>
      ))}
    </div>
  );
}

/**
 * A note and, once the agent has answered, its card. `thinking` shows the agent still at it; `onChoose` is given only
 * while the note's question is the chat's newest turn, so an old question's choices no longer act.
 */
export function Note({
  text,
  card,
  thinking,
  onChoose,
}: {
  text: string;
  card: Card | undefined;
  thinking: boolean;
  onChoose?: ((intent: ChatIntent) => void) | undefined;
}) {
  const { t, plural } = useI18n();
  return (
    <div className={C.stack}>
      <Own text={text} />
      {!card && thinking && <Thinking />}
      {card && (
        <div className="msg-agent">
          <span className={C.label}>{t(KIND_LABEL[card.kind])}</span>
          <div className="text">
            <CardText card={card} />
          </div>
          {card.kind === CardKind.answer && card.sources.length > 0 && (
            <span className={C.faint}>{plural("agent.sources", card.sources.length)}</span>
          )}
          {card.kind === CardKind.clarify && onChoose && <Choices choices={card.choices} onChoose={onChoose} />}
        </div>
      )}
    </div>
  );
}
