import { type RefObject, useEffect, useRef } from "react";

/** A thumb that lands this close to the screen's left edge can pull the drawer in. */
const EDGE_PX = 28;
/** How far a thumb moves before the swipe picks a direction (sideways pulls the drawer, up or down scrolls). */
const SLOP_PX = 10;
/** Let go past half way, the drawer finishes the move; short of it, it goes back. */
const HALF = 0.5;
/** A flick (px per ms) finishes the move however short the pull. */
const FLICK_PX_PER_MS = 0.5;
/** Set on the drawer while a thumb holds it: drawer.css drops its transitions so it follows the thumb exactly. */
const DRAGGING = "dragging";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The drawer under the thumb: closed, a pull from the left edge brings it in as far as the thumb goes; open, a push to
 * the left on it or on its shade takes it out the same way. On letting go it finishes the move it is closer to, or the
 * one a flick points at. A swipe that starts up or down is left to the page's scrolling. The position is written
 * straight to the elements (drawer.css reads --drawer-p), so a frame never waits on React.
 */
export function useDrawerSwipe(
  root: RefObject<HTMLDivElement | null>,
  panel: RefObject<HTMLElement | null>,
  open: boolean,
  onOpenChange: (open: boolean) => void,
) {
  const openNow = useRef(open);
  openNow.current = open;

  useEffect(() => {
    const el = root.current;
    const drawer = panel.current;
    if (!el || !drawer) return;
    let x0 = 0;
    let y0 = 0;
    let t0 = 0;
    let from = 0;
    let p = 0;
    let tracking = false;
    let dragging = false;

    const show = (progress: number) => {
      p = progress;
      el.style.setProperty("--drawer-p", String(progress));
    };
    const onStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (e.touches.length !== 1 || !touch) return;
      const wasOpen = openNow.current;
      // Closed: only from the very edge. Open: from anywhere on the drawer or its shade.
      if (!wasOpen && touch.clientX > EDGE_PX) return;
      if (wasOpen && !el.contains(e.target as Node)) return;
      tracking = true;
      dragging = false;
      x0 = touch.clientX;
      y0 = touch.clientY;
      t0 = performance.now();
      from = wasOpen ? 1 : 0;
    };
    const onMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!tracking || !touch) return;
      const dx = touch.clientX - x0;
      const dy = touch.clientY - y0;
      if (!dragging) {
        if (Math.abs(dx) < SLOP_PX && Math.abs(dy) < SLOP_PX) return;
        // Up or down first: the page (or the drawer's list) scrolls, and this swipe is not the drawer's.
        if (Math.abs(dy) > Math.abs(dx)) {
          tracking = false;
          return;
        }
        dragging = true;
        el.dataset[DRAGGING] = "";
      }
      if (e.cancelable) e.preventDefault();
      show(clamp01(from + dx / drawer.offsetWidth));
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      if (!dragging) return;
      dragging = false;
      const end = e.changedTouches[0]?.clientX ?? x0;
      const speed = (end - x0) / Math.max(1, performance.now() - t0);
      const flick = Math.abs(speed) > FLICK_PX_PER_MS;
      const opens = flick ? speed > 0 : p > HALF;
      delete el.dataset[DRAGGING];
      el.style.removeProperty("--drawer-p");
      if (opens !== openNow.current) onOpenChange(opens);
    };
    const opts = { passive: false } as const;
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, opts);
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [root, panel, onOpenChange]);
}
