// "Behind the scenes": a tall section whose stage sticks while the page scrolls through it. Twenty cards in five rows
// fill one after another as the scroll advances, and the phone beside them shows the screen for the row being filled,
// each part of the screen lighting up as its card fills. The progress the cards see chases the scroll position a
// little behind it, so a wheel step or a trackpad flick never lands as a jump. Phones and reduced-motion settings get
// the stage in flow, every card filled and the first screen showing. Plain browser JS on purpose: the website loads
// no app code.

const MOTION = "(min-width: 760px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const FILL = "--fill";
const PROGRESS = "--p";
const FILLED = "filled";
const DONE = "done";
const ACTIVE = "active";
const ON = "on";
const OFF = "off";
const NAME = "name";
const TRUE = "true";
const FALSE = "false";
/** Cards start one unit apart and each takes this many units to fill, so neighbours overlap a little. */
const CARD_WINDOW = 1.6;
/** The time, in milliseconds, for the shown progress to close most of the gap to the scroll: the sweep's lag. */
const CHASE_MS = 120;
/** A frame longer than this (a background tab, a stall) is treated as this long, so the sweep never leaps. */
const MAX_FRAME_MS = 50;
/** Close enough to stop chasing. */
const SETTLED = 0.0005;
/** A card counts as filled, and its part of the screen lights up, once its fill passes this point. */
const COUNTED_AT = 0.5;
/** The pinned distance is shared out as a short lead-in, the sweep, and a hold with every card filled. */
const LEAD_IN = 0.06;
const SWEEP = 0.76;
/** A viewport shorter than this cannot hold the stage, so it gets the layout in flow instead. */
const MIN_VIEWPORT_PX = 560;
const FIRST_SCREEN = 0;
/** The width, in pixels, the screens are drawn at; the phone scales them to its own width. */
const DRAWN_SCREEN_PX = 276;
const SCALE = "--k";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (p) => p * p * (3 - 2 * p);

/**
 * @param {{
 *   section: HTMLElement, stage: HTMLElement, jobs: Iterable<HTMLElement>, rows: Iterable<HTMLElement>,
 *   count: HTMLElement, track: HTMLElement, screens: Iterable<HTMLElement>, tabs: Iterable<HTMLElement>,
 *   phoneScreen: HTMLElement, screenName: HTMLElement, screenIndex: HTMLElement
 * }} parts
 */
export function startJobs(parts) {
  const { section, stage, jobs, rows, count, track, screens, tabs, phoneScreen, screenName, screenIndex } = parts;
  const motion = matchMedia(MOTION);
  const reduced = matchMedia(REDUCED_MOTION);
  const cards = [...jobs];
  const rowList = [...rows];
  const screenList = [...screens];
  const tabList = [...tabs];
  const span = cards.length - 1 + CARD_WINDOW;
  // the part of a screen that lights up with each card
  const groupOf = cards.map((card) => Number(card.dataset.group ?? 0));
  const partOf = cards.map(
    (card, i) => screenList[groupOf[i]]?.querySelector(`[data-item="${card.dataset.item}"]`) ?? null,
  );
  let active = -1;
  let enabled = false;
  let top = 0;
  let distance = 1;
  let shown = 0;
  let target = 0;
  let frame = 0;
  let lastFrame = 0;

  /** Shows one screen: the old one slides away to the left, the new one slides in from the right. */
  function showScreen(index) {
    if (index === active) return;
    screenList.forEach((screen, i) => {
      screen.classList.toggle(OFF, i === active);
      screen.classList.toggle(ON, i === index);
    });
    for (const list of [rowList, tabList]) {
      list.forEach((node, i) => {
        node.dataset[ACTIVE] = i === index ? TRUE : FALSE;
      });
    }
    screenName.textContent = screenList[index].dataset[NAME] ?? "";
    screenIndex.textContent = `${index + 1} / ${screenList.length}`;
    active = index;
  }

  function paint(progress) {
    let filled = 0;
    let current = -1;
    cards.forEach((card, i) => {
      const fill = ease(clamp01((progress * span - i) / CARD_WINDOW));
      card.style.setProperty(FILL, fill.toFixed(3));
      const done = fill >= COUNTED_AT;
      card.dataset[FILLED] = done ? TRUE : FALSE;
      if (partOf[i]) partOf[i].dataset[DONE] = done ? TRUE : FALSE;
      if (done) filled += 1;
      else if (current < 0) current = i;
    });
    count.textContent = String(filled);
    track.style.setProperty(PROGRESS, progress.toFixed(4));
    return current < 0 ? screenList.length - 1 : groupOf[current];
  }

  function rest() {
    section.dataset.motion = FALSE;
    paint(1);
    showScreen(FIRST_SCREEN);
  }

  function measure() {
    phoneScreen.style.setProperty(SCALE, (phoneScreen.clientWidth / DRAWN_SCREEN_PX).toFixed(4));
    enabled = motion.matches && !reduced.matches && window.innerHeight >= MIN_VIEWPORT_PX;
    if (!enabled) {
      rest();
      return;
    }
    section.dataset.motion = TRUE;
    const rect = section.getBoundingClientRect();
    top = rect.top + window.scrollY;
    distance = Math.max(1, rect.height - stage.getBoundingClientRect().height);
    onScroll();
  }

  function step(now) {
    frame = 0;
    const gap = target - shown;
    if (Math.abs(gap) < SETTLED) {
      shown = target;
      lastFrame = 0;
      showScreen(paint(shown));
      return;
    }
    // exponential chase on wall-clock time: the same sweep on a 60 Hz and a 120 Hz screen
    const elapsed = lastFrame ? Math.min(MAX_FRAME_MS, now - lastFrame) : MAX_FRAME_MS / 3;
    lastFrame = now;
    shown += gap * (1 - Math.exp(-elapsed / CHASE_MS));
    showScreen(paint(shown));
    frame = requestAnimationFrame(step);
  }

  function onScroll() {
    if (!enabled) return;
    const raw = clamp01((window.scrollY - top) / distance);
    target = clamp01((raw - LEAD_IN) / SWEEP);
    if (!frame) frame = requestAnimationFrame(step);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measure);
  motion.addEventListener("change", measure);
  reduced.addEventListener("change", measure);
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  if (document.fonts?.ready) document.fonts.ready.then(measure);
  window.addEventListener("load", measure);
  measure();
}
