// "How it works": five steps as an accordion beside a phone. One step is open at a time; its four cards show and the
// phone shows that step's screen and tab. A reader opens a step by clicking its row (or the phone's tab), or by
// scrolling: on a wide screen the stage sticks while the page scrolls through the section, and the scroll walks the
// steps from 01 to 05. A click there also moves the scroll to that step, so scrolling on carries on from it. Phones and
// short screens get the section in flow, opened by tap only. Plain browser JS on purpose: the website loads no app code.

const MOTION = "(min-width: 760px)";
const REDUCED = "(prefers-reduced-motion: reduce)";
const PROGRESS = "--p";
const ACTIVE = "active";
const ON = "on";
const OFF = "off";
const NAME = "name";
const TRUE = "true";
const FALSE = "false";
const EXPANDED = "aria-expanded";
const FIRST_STEP = 0;
/** A viewport shorter than this cannot hold the stage, so it gets the layout in flow instead. */
const MIN_VIEWPORT_PX = 640;
/** The pinned distance is shared out as a short lead-in, the steps, and a short hold on the last one. */
const LEAD_IN = 0.04;
const SWEEP = 0.9;
/** After a click scrolls the page, the scroll is not read again until it settles, so no step in between flashes. */
const CLICK_LOCK_MS = 900;
/** The width, in pixels, the screens are drawn at; the phone scales them to its own width. */
const DRAWN_SCREEN_PX = 276;
const SCALE = "--k";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const pad = (n) => String(n).padStart(2, "0");

/**
 * @param {{
 *   section: HTMLElement, stage: HTMLElement, rows: Iterable<HTMLElement>, count: HTMLElement, track: HTMLElement,
 *   screens: Iterable<HTMLElement>, tabs: Iterable<HTMLElement>, phoneScreen: HTMLElement,
 *   screenName: HTMLElement, screenIndex: HTMLElement
 * }} parts
 */
export function startJobs(parts) {
  const { section, stage, rows, count, track, screens, tabs, phoneScreen, screenName, screenIndex } = parts;
  const motion = matchMedia(MOTION);
  const reduced = matchMedia(REDUCED);
  const rowList = [...rows];
  const screenList = [...screens];
  const tabList = [...tabs];
  const steps = rowList.length;
  let active = -1;
  let pinned = false;
  let top = 0;
  let distance = 1;
  let lockedUntil = 0;
  let frame = 0;

  /** Opens one step: its row and cards, its screen (sliding in from the right) and its tab. */
  function show(index) {
    if (index === active) return;
    rowList.forEach((row, i) => {
      const open = i === index;
      row.dataset[ACTIVE] = open ? TRUE : FALSE;
      row.querySelector("button")?.setAttribute(EXPANDED, open ? TRUE : FALSE);
      const cards = row.querySelector(".jobs-cards");
      if (cards) cards.inert = !open;
    });
    screenList.forEach((screen, i) => {
      screen.classList.toggle(OFF, i === active);
      screen.classList.toggle(ON, i === index);
    });
    tabList.forEach((tab, i) => {
      tab.dataset[ACTIVE] = i === index ? TRUE : FALSE;
    });
    screenName.textContent = screenList[index]?.dataset[NAME] ?? "";
    screenIndex.textContent = `${index + 1} / ${screenList.length}`;
    count.textContent = pad(index + 1);
    track.style.setProperty(PROGRESS, ((index + 1) / steps).toFixed(4));
    active = index;
  }

  /** The scroll position, within the pinned section, at which a step sits in the middle of its share. */
  const scrollFor = (index) => top + distance * (LEAD_IN + (SWEEP * (index + 0.5)) / steps);

  function choose(index) {
    show(index);
    if (!pinned) return;
    lockedUntil = performance.now() + CLICK_LOCK_MS;
    window.scrollTo({ top: scrollFor(index), behavior: reduced.matches ? "auto" : "smooth" });
  }

  function measure() {
    phoneScreen.style.setProperty(SCALE, (phoneScreen.clientWidth / DRAWN_SCREEN_PX).toFixed(4));
    pinned = motion.matches && window.innerHeight >= MIN_VIEWPORT_PX;
    section.dataset.motion = pinned ? TRUE : FALSE;
    if (!pinned) return;
    const rect = section.getBoundingClientRect();
    top = rect.top + window.scrollY;
    distance = Math.max(1, rect.height - stage.getBoundingClientRect().height);
    onScroll();
  }

  function read() {
    frame = 0;
    if (!pinned || performance.now() < lockedUntil) return;
    const progress = clamp01(((window.scrollY - top) / distance - LEAD_IN) / SWEEP);
    show(Math.min(steps - 1, Math.floor(progress * steps)));
  }

  function onScroll() {
    if (pinned && !frame) frame = requestAnimationFrame(read);
  }

  rowList.forEach((row, i) => {
    row.querySelector("button")?.addEventListener("click", () => choose(i));
  });
  tabList.forEach((tab, i) => {
    tab.addEventListener("click", () => choose(i));
  });

  show(FIRST_STEP);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", measure);
  motion.addEventListener("change", measure);
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  if (document.fonts?.ready) document.fonts.ready.then(measure);
  window.addEventListener("load", measure);
  measure();
}
