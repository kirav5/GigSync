import { type Card, CardKind, type Agent as CoreAgent, type MessageKey, type Ports } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import type { Account } from "../adapters/account.js";
import { useChosenModel } from "../adapters/model.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Said } from "../ui/Said.js";

interface Turn {
  id: number;
  own: string;
  card?: Card;
}

/** Ready requests for a gig worker's agent, in each language, matching what the on-phone router understands. */
const STARTERS: readonly MessageKey[] = ["agent.starter_1", "agent.starter_2", "agent.starter_3"];

/** The heading each card kind gets on screen. */
const KIND_LABEL: Readonly<Record<Card["kind"], MessageKey>> = {
  [CardKind.text]: "card.text",
  [CardKind.saved]: "card.saved",
  [CardKind.answer]: "card.answer",
  [CardKind.draft]: "card.draft",
  [CardKind.needsModel]: "card.needs_model",
};

/** A card's words: a phrase in the owner's language, or quoted words translated on the phone when needed. */
function CardText({ card }: { card: Card }) {
  const { t } = useI18n();
  if ("say" in card) return <>{t(card.say.key, card.say.params)}</>;
  return <Said text={card.words.text} from={card.words.lang} />;
}

interface TalkProps {
  agent: CoreAgent;
  ports: Ports;
  account: Account;
  /** Start (or resume) the card interview instead of the notes chat. */
  interview: boolean;
  /** The account after the interview published the card. */
  onSaved: (a: Account) => void;
}

/** The worker's agent: notes and answers from them, on this phone (lite mode without a model). */
export function AgentScreen({ agent }: TalkProps) {
  const { t, plural } = useI18n();
  const model = useChosenModel();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(message: string) {
    const own = message.trim();
    if (!own || busy) return;
    setText("");
    setBusy(true);
    const id = Date.now();
    setTurns((t) => [...t, { id, own }]);
    try {
      const { card } = await agent.handle(own);
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, card } : x)));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(text);
  }

  return (
    <>
      <div className={C.stack}>
        <span className={C.labelSq}>{t("nav.agent")}</span>
        <h1 className={C.headline}>
          {t("agent.headline")} <span className={C.soft}>{t("agent.soft")}</span>
        </h1>
        <span className={C.faint}>{t("agent.model_line", { model: model.label(t) })}</span>
      </div>
      {turns.length === 0 && (
        <div className={C.row}>
          {STARTERS.map((s) => (
            <button key={s} type={C.button} className={C.chip} onClick={() => void send(t(s))}>
              {t(s)}
            </button>
          ))}
        </div>
      )}
      {turns.map((turn) => (
        <div key={turn.id} className={C.stack}>
          <div className="msg-user">
            <div className="bubble">{turn.own}</div>
          </div>
          {turn.card && (
            <div className="msg-agent">
              <span className={C.label}>{t(KIND_LABEL[turn.card.kind])}</span>
              <div className="text">
                <CardText card={turn.card} />
              </div>
              {turn.card.kind === CardKind.answer && turn.card.sources.length > 0 && (
                <span className={C.faint}>{plural("agent.sources", turn.card.sources.length)}</span>
              )}
            </div>
          )}
        </div>
      ))}
      <form className="composer" onSubmit={onSubmit}>
        <div className="bar">
          <input
            id="message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("agent.placeholder")}
            autoComplete={C.off}
          />
          <button type="submit" className="send" disabled={busy || !text.trim()} aria-label={t("a11y.send")}>
            →
          </button>
        </div>
      </form>
    </>
  );
}
