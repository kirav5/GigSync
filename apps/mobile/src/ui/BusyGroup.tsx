import { type MouseEvent, type ReactNode, useLayoutEffect, useRef } from "react";
import { Working } from "./Working.js";

/** The attribute motion.css draws the ring from, and its one value. */
const ARIA_BUSY = "aria-busy";
const TRUE = "true";
const CONTROL = "button";

/**
 * The controls of one decision, which wait together: while `busy` none of them can be tapped, so "Sign" can't be
 * followed by "Decline", the button tapped shows a ring, and a line says the phone is working. Works for what is inside
 * it however deep, form or button, and draws no box, so it wraps any part of a screen without changing its layout. The
 * ring is set on the element, because the tap is the only thing that knows which button it was; a button that goes
 * during the wait, as a job moves on, takes the ring with it and leaves the line.
 */
export function BusyGroup({ busy, children }: { busy: boolean; children: ReactNode }) {
  const tapped = useRef<Element | null>(null);
  useLayoutEffect(() => {
    const control = tapped.current;
    if (!busy || !control) return;
    control.setAttribute(ARIA_BUSY, TRUE);
    return () => control.removeAttribute(ARIA_BUSY);
  }, [busy]);
  function remember(e: MouseEvent) {
    if (!busy && e.target instanceof Element) tapped.current = e.target.closest(CONTROL);
  }
  return (
    <fieldset className="busy-group" disabled={busy} onClickCapture={remember}>
      {children}
      <Working on={busy} />
    </fieldset>
  );
}
