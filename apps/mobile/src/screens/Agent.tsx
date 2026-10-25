import { type Card, CardKind, type Agent as CoreAgent } from "@gigsync/core";
import { type FormEvent, useState } from "react";
import { C } from "../ui/cls.js";

interface Turn {
  id: number;
  own: string;
  card?: Card;
}

/** Ready requests for a gig worker's agent, matching what the on-phone router understands today. */
const STARTERS = [
  "remember the customer on 3rd floor pays on the 5th",
  "what did I note about the 3rd floor customer?",
  "remember Sunday is my weekly off",
];

/** The worker's agent: notes and answers from them, on this phone (lite mode without a model). */
export function AgentScreen({ agent, modelLabel }: { agent: CoreAgent; modelLabel: string }) {
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
        <span className={C.labelSq}>Ask my agent</span>
        <h1 className={C.headline}>
          Your agent. <span className={C.soft}>Your notes stay here.</span>
        </h1>
        <span className={C.faint}>{modelLabel}</span>
      </div>
      {turns.length === 0 && (
        <div className={C.row}>
          {STARTERS.map((s) => (
            <button key={s} type={C.button} className="chip" onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {turns.map((t) => (
        <div key={t.id} className={C.stack}>
          <div className="msg-user">
            <div className="bubble">{t.own}</div>
          </div>
          {t.card && (
            <div className="msg-agent">
              <span className={C.label}>{t.card.kind.replace("_", " ")}</span>
              <div className="text">{t.card.body}</div>
              {t.card.kind === CardKind.answer && t.card.sources.length > 0 && (
                <span className={C.faint}>from {t.card.sources.length} note(s)</span>
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
            placeholder="Note something or ask your agent…"
            autoComplete={C.off}
          />
          <button type="submit" className="send" disabled={busy || !text.trim()} aria-label="Send">
            →
          </button>
        </div>
      </form>
    </>
  );
}
