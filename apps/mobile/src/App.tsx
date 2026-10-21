import { Agent, type Card } from "@collab/core";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPorts } from "./adapters/ports.js";

interface Turn {
  id: number;
  own: string;
  card?: Card;
}

const STARTERS = [
  "remember Arjun said the trip is on 3 Nov",
  "what did Arjun say about the trip?",
  "is Meera free on Friday?",
];

export function App() {
  const agent = useMemo(() => new Agent(createPorts()), []);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState("web");
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => setPlatform(Capacitor.getPlatform()));
  }, []);

  useEffect(() => {
    if (turns.length > 0) log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [turns]);

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
    <div className="app">
      <header>
        <h1>Collab</h1>
        <small>{platform} · lite mode (no model)</small>
      </header>
      <div className="log" ref={log}>
        {turns.length === 0 && (
          <div className="hint">
            Your agent keeps notes on this device and answers from them. Try:
            {STARTERS.map((s) => (
              <div key={s}>
                <button
                  type="button"
                  onClick={() => void send(s)}
                  style={{ background: "transparent", color: "var(--accent)", padding: "4px 0" }}
                >
                  {s}
                </button>
              </div>
            ))}
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} style={{ display: "contents" }}>
            <div className="bubble own">{t.own}</div>
            {t.card && (
              <div className="bubble agent">
                <span className="kind">{t.card.kind.replace("_", " ")}</span>
                {t.card.body}
                {t.card.kind === "answer" && t.card.sources.length > 0 && (
                  <span className="sources">from {t.card.sources.length} note(s)</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={onSubmit}>
        <input
          id="message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask or tell your agent…"
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
