import { useEffect, useState } from "react";
import "./typed.css";

/** A letter at a time, at a pace the eye follows; a long reply speeds up so it never takes more than MOST_MS. */
const LETTER_MS = 45;
const MOST_MS = 6000;
/** The cursor stays, blinking, a moment after the last letter, as if the assistant might go on. */
const LINGER_MS = 900;
const REDUCED = "(prefers-reduced-motion: reduce)";

const stillMotion = (): boolean => typeof matchMedia === "function" && matchMedia(REDUCED).matches;

/**
 * How many of `text`'s letters to show while the assistant writes it out, as the AI apps do, and whether it is still
 * at it: the cursor shows until a moment after the last letter. Off (`on` false) or with reduced motion asked for, the
 * whole text at once. A reply written out stays whole while it is on screen.
 */
export function useTyped(text: string, on: boolean): { shown: number; writing: boolean } {
  const whole = !on || stillMotion();
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
