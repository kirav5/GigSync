// The transitions between the sections below the opening. Each one is drawn in flow.css from a single number, --p,
// that this file keeps on every [data-flow] element: 0 when the element's top enters the bottom of the screen, 1 when
// its bottom leaves the top. The number chases the scroll in the time domain, as the opening does, so a wheel notch
// glides; only the elements on screen are followed. With Reduce Motion on the number is left alone and the stylesheet's
// settled default (0.5) holds, so every transition is shown at rest.
//
// Headlines arrive line by line: each line of a marked h2 rises out of its own mask the first time it comes on screen.

const FLOW = "--p";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const LINE_BREAK = /<br\s*\/?>/i;
const ARRIVED = "arrived";
const TRUE = "true";
/** The time, in milliseconds, for the shown number to close most of the gap to the scroll. */
const CHASE_MS = 120;
const MAX_FRAME_MS = 50;
const SETTLED = 0.0005;
/** How far below the screen, in pixels, an element starts being followed, so it is right when it appears. */
const MARGIN = "200px 0px";
/** The share of a headline that must be on screen before its lines rise. */
const ARRIVE_SHARE = 0.4;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Scroll-linked transitions: keeps --p on each element. */
export function startFlow(nodes) {
  if (matchMedia(REDUCED_MOTION).matches || !("IntersectionObserver" in window)) return;
  /** @type {Map<HTMLElement, number>} the number shown on each element that is on screen */
  const live = new Map();
  let frame = 0;
  let last = 0;

  const target = (node) => {
    const r = node.getBoundingClientRect();
    return clamp01((window.innerHeight - r.top) / (window.innerHeight + r.height));
  };
  const put = (node, p) => node.style.setProperty(FLOW, p.toFixed(4));

  function render(now) {
    frame = 0;
    const elapsed = last ? Math.min(MAX_FRAME_MS, now - last) : MAX_FRAME_MS / 3;
    const share = 1 - Math.exp(-elapsed / CHASE_MS);
    let moving = false;
    for (const [node, shown] of live) {
      const gap = target(node) - shown;
      const next = Math.abs(gap) < SETTLED ? shown + gap : shown + gap * share;
      if (next !== shown) put(node, next);
      live.set(node, next);
      if (Math.abs(gap) >= SETTLED) moving = true;
    }
    last = moving ? now : 0;
    if (moving) frame = requestAnimationFrame(render);
  }
  const schedule = () => {
    if (!frame && live.size) frame = requestAnimationFrame(render);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          live.delete(entry.target);
          continue;
        }
        // an element that comes on screen starts where the scroll is, not where it was left
        const p = target(entry.target);
        put(entry.target, p);
        live.set(entry.target, p);
      }
      schedule();
    },
    { rootMargin: MARGIN },
  );
  for (const node of nodes) {
    put(node, target(node));
    io.observe(node);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

/** Splits each headline at its line breaks into masked lines that rise in turn when it first comes on screen. */
export function revealLines(headings) {
  const calm = matchMedia(REDUCED_MOTION).matches || !("IntersectionObserver" in window);
  for (const heading of headings) {
    const lines = heading.innerHTML.split(LINE_BREAK);
    heading.innerHTML = lines
      .map((line, i) => `<span class="line" style="--i:${i}"><span>${line.trim()}</span></span>`)
      .join("");
    heading.dataset.lines = TRUE;
    if (calm) heading.dataset[ARRIVED] = TRUE;
  }
  if (calm) return;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset[ARRIVED] = TRUE;
        io.unobserve(entry.target);
      }
    },
    { threshold: ARRIVE_SHARE },
  );
  for (const heading of headings) {
    // a headline already above the screen (a reload half way down) is shown at once
    if (heading.getBoundingClientRect().bottom < 0) heading.dataset[ARRIVED] = TRUE;
    else io.observe(heading);
  }
}
