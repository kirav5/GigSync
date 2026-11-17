import { type Card, CardKind, type ChatIntent, type MessageKey } from "@gigsync/core";
import { useI18n } from "../../i18n.js";
import { C } from "../../ui/cls.js";
import { Said } from "../../ui/Said.js";
import { Typed } from "../../ui/Typed.js";
import { Dots } from "../../ui/Working.js";
import { ScheduleLines } from "../schedule/ScheduleLines.js";
import { Own } from "./Bubbles.js";

/**
 * A note to the agent in Talk and what came of it: the agent's card once it has answered, three pulsing dots while it
 * is still working on it (the phone's model can take seconds), and, when it could not tell what the owner meant, its
 * question with one choice per meaning (ADR 0042 amendment 2026-11-03).
 */

/** The small line under the words that says what kind of answer it is; plain replies need none. */
const KIND_LABEL: Readonly<Partial<Record<Card["kind"], MessageKey>>> = {
  [CardKind.saved]: "card.saved",
  [CardKind.answer]: "card.answer",
  [CardKind.draft]: "card.draft",
  [CardKind.schedule]: "card.schedule",
};

/**
 * A card's words: a phrase in the owner's language, written out letter by letter while it is the newest (`typing`),
 * or quoted words translated on the phone when needed.
 */
function CardText({ card, typing }: { card: Card; typing: boolean }) {
  const { t } = useI18n();
  if ("say" in card) return <Typed text={t(card.say.key, card.say.params)} on={typing} />;
  return <Said text={card.words.text} from={card.words.lang} />;
}

/** The agent at work: dots that pulse (fading only, where the owner asked for less motion) and the words for it. */
export function Thinking() {
  const { t } = useI18n();
  return (
    <div className="msg-agent thinking" role="status">
      <Dots />
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
  typing = false,
  onChoose,
}: {
  text: string;
  card: Card | undefined;
  thinking: boolean;
  /** The chat's newest note: its answer writes itself out. */
  typing?: boolean;
  onChoose?: ((intent: ChatIntent) => void) | undefined;
}) {
  const { t, plural } = useI18n();
  return (
    <div className={C.stack}>
      <Own text={text} />
      {!card && thinking && <Thinking />}
      {card && (
        <div className="msg-agent">
          <div className="text">
            <CardText card={card} typing={typing} />
          </div>
          {KIND_LABEL[card.kind] && <span className="msg-kind">{t(KIND_LABEL[card.kind] as MessageKey)}</span>}
          {card.kind === CardKind.schedule && <ScheduleLines card={card} />}
          {card.kind === CardKind.answer && card.sources.length > 0 && (
            <span className={C.faint}>{plural("agent.sources", card.sources.length)}</span>
          )}
          {card.kind === CardKind.clarify && onChoose && <Choices choices={card.choices} onChoose={onChoose} />}
        </div>
      )}
    </div>
  );
}
