import { createContext, useContext, useEffect, useState } from "react";
import { ownerSaidAt } from "./saidClock.js";
import "./typed.css";

/** A letter at a time, at a pace the eye follows; a long reply speeds up so it never takes more than MOST_MS. */
const LETTER_MS = 28;
const MOST_MS = 6000;
/** The cursor stays, blinking, a moment after the last letter, as if the assistant might go on. */
const LINGER_MS = 900;
const REDUCED = "(prefers-reduced-motion: reduce)";

/** A reply is written out only while it answers words the owner said this recently. */
const ANSWER_MS = 30_000;
/** A chat that came on screen this long after the owner spoke was opened or come back to: its replies show whole. */
const OPENED_AFTER_MS = 1000;

const stillMotion = (): boolean => typeof matchMedia === "function" && matchMedia(REDUCED).matches;

/** When the chat on screen was opened (performance.now()); 0 outside a chat, where every reply writes itself out. */
export const ChatOpened = createContext(0);

/**
 * When the chat named by `key` (its first turn, or its id) came on screen: opening another chat, or coming back to
 * this one, starts it again, so the replies already there show whole and only those that come later are written out.
 */
/** The key of a chat with no turns yet. */
export const EMPTY_CHAT = "";

export function useOpenedAt(key: string): number {
  const [seen, setSeen] = useState(() => ({ key, at: performance.now() }));
  // An empty chat getting its first turn is the same chat, not another one opened.
  if (seen.key === key || seen.key === EMPTY_CHAT) {
    if (seen.key !== key) setSeen({ key, at: seen.at });
    return seen.at;
  }
  const next = { key, at: performance.now() };
  setSeen(next);
  return next.at;
}

/**
 * How many of `text`'s letters to show while the assistant writes it out, as the AI apps do, and whether it is still
 * at it: the cursor shows until a moment after the last letter. Off (`on` false) or with reduced motion asked for, the
 * whole text at once. A reply written out stays whole while it is on screen.
 */
export function useTyped(text: string, on: boolean): { shown: number; writing: boolean } {
  const openedAt = useContext(ChatOpened);
  // Decided once, as the reply comes on screen: it answers words just said, in the chat they were said in.
  const [fresh] = useState(() => {
    const said = ownerSaidAt();
    return said > 0 && performance.now() - said < ANSWER_MS && openedAt - said < OPENED_AFTER_MS;
  });
  const whole = !on || !fresh || stillMotion();
  const [shown, setShown] = useState(whole ? text.length : 0);
  const [lingering, setLingering] = useState(!whole);
  const done = whole || shown >= text.length;
  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => setLingering(false), LINGER_MS);
      return () => clearTimeout(timer);
    }
    const per = Math.max(1, Math.ceil((text.length * LETTER_MS) / MOST_MS));
    const timer = setTimeout(() => setShown(Math.min(text.length, shown + per)), LETTER_MS);
    return () => clearTimeout(timer);
  }, [done, text, shown]);
  return { shown: done ? text.length : shown, writing: !whole && (!done || lingering) };
}

/** The blinking cursor at the end of the words being written. */
export function Cursor() {
  return <span className="typed-cursor" aria-hidden="true" />;
}

/** `text` written out letter by letter with the cursor after it while `on`, then the text alone. */
export function Typed({ text, on }: { text: string; on: boolean }) {
  const { shown, writing } = useTyped(text, on);
  return (
    <>
      {text.slice(0, shown)}
      {writing && <Cursor />}
    </>
  );
}
