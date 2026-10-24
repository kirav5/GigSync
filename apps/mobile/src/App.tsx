import { Agent, type Card, CardKind } from "@gigsync/core";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiReachable } from "./adapters/api.js";
import { createPorts, modelLabel } from "./adapters/ports.js";
import { PaymentsPanel } from "./payments/PaymentsPanel.js";

/** The two screens: the agent chat and the worker's payments. */
const Tab = { agent: "agent", pay: "pay" } as const;
type Tab = (typeof Tab)[keyof typeof Tab];
const BUTTON = "button";

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
  const ports = useMemo(createPorts, []);
  const agent = useMemo(() => new Agent(ports), [ports]);
  const [tab, setTab] = useState<Tab>(Tab.agent);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState("web");
  const [online, setOnline] = useState<boolean>();
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import("@capacitor/core").then(({ Capacitor }) => setPlatform(Capacitor.getPlatform()));
    void apiReachable().then(setOnline);
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
        <h1>GigSync</h1>
        <nav>
          <button type={BUTTON} aria-pressed={tab === Tab.agent} onClick={() => setTab(Tab.agent)}>
            Agent
          </button>
          <button type={BUTTON} aria-pressed={tab === Tab.pay} onClick={() => setTab(Tab.pay)}>
            Get paid
          </button>
        </nav>
        <small>
          {platform} · {modelLabel}
          {online !== undefined && ` · ${online ? "online" : "offline"}`}
        </small>
      </header>
      {tab === Tab.pay && <PaymentsPanel ports={ports} />}
      {tab === Tab.agent && (
        <>
          <div className="log" ref={log}>
            {turns.length === 0 && (
              <div className="hint">
                Your agent keeps notes on this device and answers from them. Try:
                {STARTERS.map((s) => (
                  <div key={s}>
                    <button
                      type={BUTTON}
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
                    {t.card.kind === CardKind.answer && t.card.sources.length > 0 && (
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
        </>
      )}
    </div>
  );
}
