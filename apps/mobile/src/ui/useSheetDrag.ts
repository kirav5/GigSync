import { type RefObject, useEffect } from "react";

/** How far a finger moves before it counts as a drag rather than a tap. */
const SLOP_PX = 8;
/** Pulled down past this share of its own height, the sheet goes when let go. */
const DISMISS_SHARE = 0.25;
/** A flick: let go moving down at least this fast (px per ms), the sheet goes however short the pull. */
const FLICK_PX_PER_MS = 0.6;
/** Pulled up, it moves only this share of the finger's way: it is already as high as it goes. */
const UP_RESIST = 0.2;
/** Let go short of dismissing, it springs back home in this long. */
const SNAP_MS = 240;
const SNAP = `transform ${SNAP_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;
/** Set on the panel while a finger holds it, so sheet.css drops its animations and follows the finger. */
const DRAGGING = "dragging";

/**
 * A sheet a finger can hold: pulled down from its handle, its title row or, once its scrolling body is at the top,
 * from anywhere, it follows the finger; let go far enough or with a flick it closes, otherwise it springs back. A drag
 * that started on a row does not also tap it. Touch only: a mouse has the scrim, Escape and Done.
 */
export function useSheetDrag(
  panel: RefObject<HTMLDivElement | null>,
  scroller: () => HTMLElement | null,
  onDismiss: (pulled: number) => void,
) {
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    let startY = 0;
    let startAt = 0;
    let pulled = 0;
    let tracking = false;
    let dragging = false;
    let swallowClick = false;

    const place = (y: number) => {
      el.style.transform = y === 0 ? "" : `translateY(${y}px)`;
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const body = scroller();
      // Inside a body scrolled down, the finger scrolls it back up first; the pull starts from its top.
      if (body && body.contains(e.target as Node) && body.scrollTop > 0) return;
      tracking = true;
      dragging = false;
      startY = e.touches[0]?.clientY ?? 0;
      startAt = performance.now();
      pulled = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const d = (e.touches[0]?.clientY ?? startY) - startY;
      if (!dragging) {
        if (d < -SLOP_PX) tracking = false;
        if (d <= SLOP_PX) return;
        dragging = true;
        el.dataset[DRAGGING] = "";
        el.style.transition = "none";
      }
      if (e.cancelable) e.preventDefault();
      pulled = d > 0 ? d - SLOP_PX : d * UP_RESIST;
      place(pulled);
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      swallowClick = true;
      delete el.dataset[DRAGGING];
      const speed = pulled / Math.max(1, performance.now() - startAt);
      if (pulled > el.offsetHeight * DISMISS_SHARE || (pulled > 0 && speed > FLICK_PX_PER_MS)) {
        onDismiss(pulled);
        return;
      }
      el.style.transition = SNAP;
      place(0);
      window.setTimeout(() => el.style.removeProperty("transition"), SNAP_MS);
    };
    // The tap a drag ends on is not a choice.
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
    };
    const opts = { passive: false } as const;
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, opts);
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    el.addEventListener("click", onClick, true);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
      el.removeEventListener("click", onClick, true);
    };
  }, [panel, scroller, onDismiss]);
}
