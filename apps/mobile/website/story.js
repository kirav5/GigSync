// The story's phone. Twelve chapters scroll past one phone that stays put. The chapter whose text has reached its
// resting place decides which screen shows and whose phone it is: when the owner changes, the phone turns edge-on,
// swaps, and turns back. Nothing plays on a clock. A chapter's text holds still while the reader scrolls through it,
// and that scroll distance is the screen's timeline: parts appear (data-at), get pressed (data-tap), leave (data-off)
// or are typed out (data-type) as the reader scrolls down, and undo themselves as the reader scrolls back up. The
// numbers on those attributes are milliseconds of an imagined recording; PLAY_VH_PER_SECOND turns them into scroll.
// Plain browser JS on purpose: the website loads no app code.

const ON = "on";
const OFF = "off";
const GO = "go";
const TAPPED = "tapped";
const GONE = "gone";
const TURNING = "turning";
const SCREENS = ".scr";
const BODY = ".chapter-body";
const TIMED = "[data-at], [data-tap], [data-off]";
const WHEN = "[data-when]";
const NEXT = "[data-next]";
const PLAY_VAR = "--play";
const STACKED = "(max-width: 700px)";
/** How long a leaving screen keeps its "off" class: the transition in site.css takes .45s. */
const LEAVE_MS = 500;
/** Half a turn of the phone: the frame is edge-on when the swap happens. */
const TURN_MS = 270;
/** One typed letter, on a screen's timeline. */
const TYPE_MS = 55;
/** Timeline left after a screen's last step, so the finished state is reached before the text lets go. */
const TAIL_MS = 600;
/** Scroll distance, in hundredths of the viewport height, that one second of a screen's timeline takes. */
const PLAY_VH_PER_SECOND = 15;
/** The nearest a held chapter's text may sit to the top of the viewport. */
const MIN_STICK_PX = 20;
/** Gap between the pinned phone and a held chapter's text when the layout is stacked. */
const STACK_GAP_PX = 12;
/** A height change smaller than this is a phone's address bar sliding away, not a new layout. */
const BAR_SLACK_PX = 130;
/** Points of a chapter's height at which crossing the viewport edge re-reads the scroll position. */
const CROSSINGS = [0, 0.25, 0.5, 0.75, 1];

const clamp = (n, low, high) => Math.min(high, Math.max(low, n));

/** Splits text into the pieces a reader would call letters, so a Kannada syllable is typed whole. */
function letters(text) {
  if (!("Segmenter" in Intl)) return [...text];
  return [...new Intl.Segmenter().segment(text)].map((piece) => piece.segment);
}

/** A screen's timed parts, read once: when each appears, is pressed and leaves, and what it types. */
function readTimeline(screen) {
  if (screen === null) return { parts: [], length: 0 };
  const parts = [...screen.querySelectorAll(TIMED)].map((node) => {
    const { at, tap, off, type } = node.dataset;
    return {
      node,
      at: at === undefined ? null : Number(at),
      tap: tap === undefined ? null : Number(tap),
      off: off === undefined ? null : Number(off),
      typed: type === undefined ? null : letters(type),
    };
  });
  let last = 0;
  for (const part of parts) {
    const typing = part.typed === null ? 0 : part.typed.length * TYPE_MS;
    last = Math.max(last, (part.at ?? 0) + typing, part.tap ?? 0, part.off ?? 0);
  }
  return { parts, length: parts.length === 0 ? 0 : last + TAIL_MS };
}

/** Puts a screen in the state its timeline has at `time`. The same call moves it forward or back. */
function scrub(timeline, time) {
  for (const { node, at, tap, off, typed } of timeline.parts) {
    if (at !== null) node.classList.toggle(GO, time >= at);
    if (tap !== null) node.classList.toggle(TAPPED, time >= tap);
    if (off !== null) node.classList.toggle(GONE, time >= off);
    if (typed === null) continue;
    const count = clamp(Math.floor((time - (at ?? 0)) / TYPE_MS), 0, typed.length);
    const text = typed.slice(0, count).join("");
    if (node.textContent !== text) node.textContent = text;
  }
}

/**
 * @param {{ chapters: Iterable<HTMLElement>, phone: HTMLElement, stage: HTMLElement, reduceMotion: boolean }} parts
 */
export function startStory({ chapters, phone, stage, reduceMotion }) {
  const list = [...chapters];
  const bodies = list.map((chapter) => chapter.querySelector(BODY));
  const screens = list.map((_, index) => phone.querySelector(`${SCREENS}[data-step="${index}"]`));
  const timelines = screens.map(readTimeline);
  const when = phone.querySelector(WHEN);
  const stacked = matchMedia(STACKED);
  /** Per chapter: the viewport line its top crosses to take charge, and the scroll its screen plays over. */
  let marks = list.map(() => ({ line: 0, play: 0 }));
  let current = -1;
  let turn = 0;
  let width = 0;
  let height = 0;

  function leave(screen) {
    screen.classList.remove(ON);
    if (reduceMotion) return;
    screen.classList.add(OFF);
    setTimeout(() => screen.classList.remove(OFF), LEAVE_MS);
  }

  function showScreen(index) {
    const target = screens[index];
    if (target === null) return;
    for (const screen of screens) {
      if (screen !== null && screen !== target && screen.classList.contains(ON)) leave(screen);
    }
    target.classList.remove(OFF);
    target.classList.add(ON);
  }

  function show(index) {
    if (index === current) return;
    const chapter = list[index];
    for (const c of list) c.classList.toggle(ON, c === chapter);
    const who = chapter.dataset.who ?? "";
    const turning = current >= 0 && phone.dataset.who !== who && !reduceMotion;
    current = index;
    const swap = () => {
      phone.dataset.who = who;
      if (when !== null) when.textContent = chapter.dataset.when ?? "";
      showScreen(index);
    };
    clearTimeout(turn);
    phone.classList.remove(TURNING);
    if (!turning) {
      swap();
      return;
    }
    phone.classList.add(TURNING);
    turn = setTimeout(() => {
      swap();
      phone.classList.remove(TURNING);
    }, TURN_MS);
  }

  /** The chapter in charge is the last whose top has crossed its line; how far past it sets the screen's time. */
  function read() {
    let index = 0;
    list.forEach((chapter, i) => {
      if (chapter.getBoundingClientRect().top <= marks[i].line) index = i;
    });
    // When another chapter takes charge, every screen before it is left finished and every screen after it rewound,
    // so a jump (a link, the arrow, "back") lands in the same state as scrolling there would.
    if (current !== index) {
      timelines.forEach((timeline, i) => {
        if (i !== index) scrub(timeline, i < index ? timeline.length : 0);
      });
    }
    show(index);
    const { line, play } = marks[index];
    const past = line - list[index].getBoundingClientRect().top;
    const progress = play > 0 ? clamp(past / play, 0, 1) : 1;
    scrub(timelines[index], progress * timelines[index].length);
  }

  /** Where each chapter's text rests, and how much scroll its screen's timeline gets. Runs when sizes change. */
  function measure() {
    width = window.innerWidth;
    height = window.innerHeight;
    const rest = stacked.matches ? stage.offsetHeight + STACK_GAP_PX : height / 2;
    marks = list.map((chapter, index) => {
      const body = bodies[index];
      const style = getComputedStyle(chapter);
      const lead = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.borderTopWidth);
      const stick = stacked.matches ? rest : Math.max(MIN_STICK_PX, rest - body.offsetHeight / 2);
      const seconds = reduceMotion ? 0 : timelines[index].length / 1000;
      const play = Math.round(seconds * PLAY_VH_PER_SECOND * (height / 100));
      body.style.top = `${Math.round(stick)}px`;
      chapter.style.setProperty(PLAY_VAR, `${play}px`);
      return { line: Math.round(stick) - lead, play };
    });
    read();
  }

  // A phone's address bar sliding away changes the height a little on every scroll; re-measuring then would move
  // the page under the reader's finger, so only a real change of size counts.
  function onResize() {
    if (window.innerWidth === width && Math.abs(window.innerHeight - height) < BAR_SLACK_PX) return;
    measure();
  }

  // The arrow on a screen reads the page forward, the way "next" does inside the app.
  for (const button of phone.querySelectorAll(NEXT)) {
    button.addEventListener("click", () => {
      const index = Math.min(list.length - 1, current + 1);
      const top = window.scrollY + list[index].getBoundingClientRect().top - marks[index].line + 1;
      window.scrollTo({ top, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  // Read on every scroll event: twelve rectangle reads and one screen's classes, cheap enough to do without an
  // animation-frame queue, which would go quiet whenever the page sits in a background tab.
  window.addEventListener("scroll", read, { passive: true });
  window.addEventListener("resize", onResize);
  stacked.addEventListener("change", measure);
  // Text that reflows (a font arriving) changes where it rests; the phone's size changes the stacked layout's line.
  if ("ResizeObserver" in window) {
    const sizes = new ResizeObserver(measure);
    for (const body of bodies) sizes.observe(body);
    sizes.observe(stage);
  }
  // Chapters crossing the viewport also trigger a read, for browsers that deliver intersection changes but no scroll
  // event for a programmatic jump (a hash link, "back", or the next arrow).
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(read, { threshold: CROSSINGS });
    for (const chapter of list) io.observe(chapter);
  }
  measure();
}
