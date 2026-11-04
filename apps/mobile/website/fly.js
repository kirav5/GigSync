// The opening scene's driver. On wide screens the header, the hero and the roots section share one earth-brown camera
// that stays on screen while the page scrolls through the opening's track, so the reader sees a scene change rather
// than a page scroll; scene.js says what the scene looks like at each progress, and this file measures the page,
// follows the scroll and applies it. The header and the background colour never change.
//
// The scene chases the scroll position in the time domain instead of sitting on it: each animation frame the shown
// progress closes a share of the remaining gap set by the elapsed milliseconds, so a wheel notch becomes a short glide
// rather than a jump, and the glide carries on for a few frames after the wheel stops. The mural and the roots print
// stay in the document for the whole scene and move by transform and opacity alone, so nothing is swapped or laid out
// mid-flight. Phones, reduced-motion settings and short screens get the three parts stacked in normal flow.
// "?flight=direct" in the address keeps a one-to-one mapping for comparison.
import { FLIGHT_SHARE, planScene, sceneAt } from "./scene.js";

const DESKTOP = "(min-width: 800px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
/** A viewport shorter than this cannot hold the hero inside the camera. */
const MIN_VIEWPORT_PX = 600;
const MEASURING = "measuring";
const LANDED = "landed";
const FLYING = "flying";
const SHOWN = "shown";
const MOTION = "motion";
const TRUE = "true";
const FALSE = "false";
const BLOCK = "block";
const NONE = "none";
const SMOOTH = "smooth";
const INSTANT = "instant";
const FLIGHT_PARAM = "flight";
const DIRECT = "direct";
const ROOTS_HASH = "#our-roots";
/** Where the strip's arrow leads once the picture has landed: on, past the opening. */
const ONWARD = "onward";
/** The time, in milliseconds, for the shown progress to close most of the gap to the scroll: the glide's lag. */
const CHASE_MS = 140;
/** A frame longer than this (a background tab, a stall) is treated as this long, so the glide never leaps. */
const MAX_FRAME_MS = 50;
/** Close enough, in progress units, to count as arrived. */
const SETTLED = 0.0008;
/** How close, in pixels, two measurements must be to count as the same layout. */
const SAME_PX = 0.5;
/** The least opacity a layer is given: too faint to see, but enough to keep it painted, so that the first frame in
 *  which it shows does not have to wait for it. */
const PAINTED = 0.001;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** A node's box relative to a base box, so positions hold still while the page scrolls under the camera. */
const stageRect = (node, base) => {
  const r = node.getBoundingClientRect();
  return { left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height };
};
const sameRect = (a, b) =>
  Math.abs(a.left - b.left) < SAME_PX &&
  Math.abs(a.top - b.top) < SAME_PX &&
  Math.abs(a.width - b.width) < SAME_PX &&
  Math.abs(a.height - b.height) < SAME_PX;
const driftOf = (px) => `translate3d(0, ${px.toFixed(2)}px, 0)`;
/** A tilted box moved and scaled about its own centre. */
const placed = ({ x, y, scale, turnDeg }) => `translate3d(${x}px, ${y}px, 0) rotate(${turnDeg}deg) scale(${scale})`;

/**
 * @param {{
 *   opening: HTMLElement, camera: HTMLElement, heroLayer: HTMLElement, heroCopy: HTMLElement, heroArt: HTMLElement,
 *   heroFrame: HTMLElement, heroCaption: HTMLElement, strip: HTMLElement, rootsLayer: HTMLElement,
 *   rootsCopy: HTMLElement, rootsArt: HTMLElement, wash: HTMLElement, veil: HTMLElement,
 *   links: Iterable<HTMLAnchorElement>
 * }} parts
 */
export function startScene(parts) {
  const { opening, camera, heroLayer, heroCopy, heroArt, heroFrame, heroCaption, strip } = parts;
  const { rootsLayer, rootsCopy, rootsArt, wash, veil, links } = parts;
  const desktop = matchMedia(DESKTOP);
  const reduced = matchMedia(REDUCED_MOTION);
  const direct = new URLSearchParams(location.search).get(FLIGHT_PARAM) === DIRECT;
  /** Everything the scene moves; measuring needs them all back in their own places. */
  const moved = [heroCopy, rootsCopy, rootsArt];
  let plan = null;
  /** The roots print's box when the plan was made. */
  let art = null;
  let openingTop = 0;
  let flightPx = 1;
  let enabled = false;
  let frame = 0;
  let shown = 0;
  let lastFrame = 0;

  function rest() {
    opening.dataset[MOTION] = FALSE;
    wash.style.display = NONE;
    document.body.classList.remove(FLYING, LANDED);
    for (const node of [heroCopy, heroFrame, heroCaption, strip, rootsCopy, rootsArt, veil]) node.style.opacity = "";
    for (const node of moved) node.style.transform = "";
    for (const node of [heroLayer, heroCopy, strip, rootsLayer, rootsCopy]) delete node.dataset[SHOWN];
    plan = null;
  }

  function measure() {
    enabled = desktop.matches && !reduced.matches && window.innerHeight >= MIN_VIEWPORT_PX;
    if (!enabled) {
      rest();
      return;
    }
    opening.dataset[MOTION] = TRUE;
    document.body.classList.add(FLYING);
    // measured with every drift, zoom and tilt removed, relative to the stage: the pictures' positioned parent, which
    // holds still with the camera
    const transforms = moved.map((node) => node.style.transform);
    for (const node of moved) node.style.transform = "";
    rootsArt.classList.add(MEASURING);
    const base = wash.parentElement.getBoundingClientRect();
    const boxes = {
      start: stageRect(heroArt, base),
      art: stageRect(rootsArt, base),
      stage: stageRect(camera, base),
    };
    rootsArt.classList.remove(MEASURING);
    moved.forEach((node, i) => {
      node.style.transform = transforms[i];
    });
    openingTop = opening.getBoundingClientRect().top + window.scrollY;
    flightPx = Math.max(1, (opening.offsetHeight - camera.offsetHeight) * FLIGHT_SHARE);
    // a measurement that changes nothing must not move a picture in flight
    const same =
      plan && sameRect(boxes.start, plan.start) && sameRect(boxes.art, art) && sameRect(boxes.stage, plan.stage);
    if (!same) {
      plan = planScene(boxes);
      art = boxes.art;
      wash.style.width = `${plan.start.width}px`;
      wash.style.height = `${plan.start.height}px`;
      wash.style.display = BLOCK;
      shown = progressNow();
    }
    schedule();
  }

  const progressNow = () => clamp01((window.scrollY - openingTop) / flightPx);

  function fade(node, opacity) {
    node.style.opacity = opacity.toFixed(3);
    node.dataset[SHOWN] = opacity > 0 ? TRUE : FALSE;
  }

  /** Applies the scene at progress `p` to the page. */
  function draw(p) {
    const scene = sceneAt(p, plan);
    fade(heroCopy, scene.heroCopy.opacity);
    heroCopy.style.transform = driftOf(scene.heroCopy.drift);
    heroFrame.style.opacity = scene.heroFrame.toFixed(3);
    heroCaption.style.opacity = scene.heroFrame.toFixed(3);
    heroLayer.dataset[SHOWN] = scene.heroCopy.opacity > 0 || scene.heroFrame > 0 ? TRUE : FALSE;
    fade(rootsCopy, scene.rootsCopy.opacity);
    rootsCopy.style.transform = driftOf(scene.rootsCopy.drift);
    rootsArt.style.opacity = Math.max(PAINTED, scene.print.opacity).toFixed(3);
    rootsArt.style.transform = placed(scene.print);
    fade(strip, scene.strip);
    rootsLayer.dataset[SHOWN] = scene.rootsCopy.opacity > 0 || scene.print.opacity > 0 ? TRUE : FALSE;
    wash.style.opacity = scene.wash.opacity.toFixed(3);
    wash.style.transform = `translate3d(${scene.wash.x}px, ${scene.wash.y}px, 0) scale(${scene.wash.scale})`;
    veil.style.opacity = Math.max(PAINTED, scene.shade).toFixed(3);
    document.body.classList.toggle(LANDED, scene.landed);
  }

  function render(now) {
    frame = 0;
    if (!enabled || !plan) return;
    const target = progressNow();
    const gap = target - shown;
    if (direct || Math.abs(gap) < SETTLED) {
      shown = target;
      lastFrame = 0;
      draw(shown);
      return;
    }
    // exponential chase on wall-clock time: the same glide on a 60 Hz and a 120 Hz screen
    const elapsed = lastFrame ? Math.min(MAX_FRAME_MS, now - lastFrame) : MAX_FRAME_MS / 3;
    lastFrame = now;
    shown += gap * (1 - Math.exp(-elapsed / CHASE_MS));
    draw(shown);
    frame = requestAnimationFrame(render);
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };

  /** Links into the scene scroll the track instead: the roots sit at the end of the flight, the top at its start. */
  function jump(place, behavior) {
    if (!enabled) return false;
    let top = openingTop;
    if (place === ROOTS_HASH) top = openingTop + flightPx + 1;
    if (place === ONWARD) top = openingTop + opening.offsetHeight;
    window.scrollTo({ top, behavior });
    return true;
  }
  for (const link of links) {
    link.addEventListener("click", (event) => {
      const hash = link.getAttribute("href");
      // once the picture has landed, the strip's arrow leads on to the next section
      const landed = document.body.classList.contains(LANDED);
      const place = hash === ROOTS_HASH && landed && strip.contains(link) ? ONWARD : hash;
      if (jump(place, SMOOTH)) event.preventDefault();
    });
  }

  // decoded ahead of the first frame that needs them, so the scene never waits on a picture
  for (const picture of [wash.firstElementChild, rootsArt.querySelector("img")])
    picture?.decode?.().catch(() => undefined);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure);
  desktop.addEventListener("change", measure);
  reduced.addEventListener("change", measure);
  // fonts, images and opened details all move the frames; measure again whenever the page changes height
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  if (document.fonts?.ready) document.fonts.ready.then(measure);
  window.addEventListener("load", () => {
    measure();
    if (location.hash === ROOTS_HASH) jump(ROOTS_HASH, INSTANT);
  });
  measure();
}
