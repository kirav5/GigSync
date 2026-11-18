// The three idea cards under "Starting with workers". "Explore this idea" opens a card in place to its longer text;
// it closes again when the mouse moves away, on a tap or click elsewhere, when keyboard focus leaves it, and on its
// ×, its Close or Escape. The card's height glides between the two states and the words that arrive fade up, while
// site.css fades the panel's colours in; the words already on screen never move.
const OPEN = "open";
const EXPANDED = "aria-expanded";
const ESCAPE = "Escape";
const MOUSE = "mouse";
const OPENER = ".path-open";
const MORE = ".path-more";
const SHORT = ".path-short";
const CLOSE = ".path-close";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const OVERFLOW = "overflow";
const HIDDEN = "hidden";
/** How long the height glides, on a curve that starts quickly and lands softly. */
const GLIDE_MS = 420;
const GLIDE_EASE = "cubic-bezier(0.22, 0.75, 0.2, 1)";
/** The arriving words rise from this far below, starting a little after the card begins to change. */
const RISE_PX = 10;
const RISE = [
  { opacity: 0, transform: `translateY(${RISE_PX}px)` },
  { opacity: 1, transform: "none" },
];
const RISE_MS = 380;
const RISE_DELAY_MS = 90;
/** A mouse that leaves an open card for less than this has only slipped past its edge, so it stays open. */
const LEAVE_GRACE_MS = 250;

/** Wires each card's opener, its ways to close, and the motion between the two. */
export function ideaCards(cards) {
  const reduce = matchMedia(REDUCED_MOTION);
  for (const card of cards) {
    const opener = card.querySelector(OPENER);
    const more = card.querySelector(MORE);
    if (opener === null || more === null) continue;
    const motion = glider(card, reduce);
    let hovered = false;
    let leaving = 0;
    const isOpen = () => card.classList.contains(OPEN);
    // Focus moves before anything it sits on is hidden, so focus never falls out of the card on the way.
    const set = (open) => {
      if (open === isOpen()) return;
      clearTimeout(leaving);
      const from = motion.measure();
      if (open) {
        more.hidden = false;
        // the panel takes focus, not its ×, so no focus ring appears on a click or tap; Tab reaches the × next
        more.focus({ preventScroll: true });
        card.classList.add(OPEN);
      } else {
        const focused = card.contains(document.activeElement);
        card.classList.remove(OPEN);
        if (focused) opener.focus({ preventScroll: true });
        more.hidden = true;
      }
      opener.setAttribute(EXPANDED, String(open));
      motion.glide(from, open ? [more] : [card.querySelector(SHORT), opener]);
    };
    opener.addEventListener("click", () => set(true));
    for (const close of more.querySelectorAll(CLOSE)) close.addEventListener("click", () => set(false));
    card.addEventListener("keydown", (event) => {
      if (event.key === ESCAPE) set(false);
    });
    card.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== MOUSE) return;
      hovered = true;
      clearTimeout(leaving);
    });
    card.addEventListener("pointerleave", (event) => {
      if (event.pointerType !== MOUSE) return;
      hovered = false;
      if (isOpen()) leaving = setTimeout(() => set(false), LEAVE_GRACE_MS);
    });
    // a click inside the card can drop focus to the page, so focus leaving only closes it while the mouse is away
    card.addEventListener("focusout", (event) => {
      if (!hovered && !card.contains(event.relatedTarget)) set(false);
    });
    document.addEventListener("pointerdown", (event) => {
      if (isOpen() && event.target instanceof Node && !card.contains(event.target)) set(false);
    });
  }
}

/** The card's motion: its height glides from where it was to where it now is, and the given words fade up. */
function glider(card, reduce) {
  let running = null;
  return {
    /** The height on screen now, mid-glide included; any glide stops here so the next starts from this point. */
    measure() {
      const height = card.offsetHeight;
      running?.cancel();
      return height;
    },
    glide(from, arriving) {
      if (reduce.matches) return;
      const to = card.offsetHeight;
      card.style.setProperty(OVERFLOW, HIDDEN);
      const timing = { duration: GLIDE_MS, easing: GLIDE_EASE };
      const height = card.animate([{ height: `${from}px` }, { height: `${to}px` }], timing);
      running = height;
      // a stopped glide reports after the next has begun, and must not undo that one's clipping
      height.onfinish = height.oncancel = () => {
        if (running === height) card.style.removeProperty(OVERFLOW);
      };
      const rise = { ...timing, duration: RISE_MS, delay: RISE_DELAY_MS, fill: "backwards" };
      for (const node of arriving) node?.animate(RISE, rise);
    },
  };
}
