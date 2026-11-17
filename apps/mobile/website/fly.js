// The opening scene's driver. The header, the hero and the roots share one earth-brown camera that stays on screen
// while the page scrolls through the opening's track, so the reader sees the circle open rather than a page scroll;
// scene.js says what the scene looks like at each progress, and this file measures the page, follows the scroll and
// applies it. The background colour never changes.
//
// The scene chases the scroll position in the time domain instead of sitting on it: each animation frame the shown
// progress closes a share of the remaining gap set by the elapsed milliseconds, so a wheel notch becomes a short glide
// rather than a jump. The three layers of the mural stay in the document for the whole scene and change by transform
// and opacity alone, so nothing is swapped or laid out mid-flight. Phones and desktops play the same scene; only the
// layout differs (opening.css). With Reduce Motion on the scene only fades. Very short screens get the hero and the
// roots one after the other in normal flow.
// "?flight=direct" in the address keeps a one-to-one mapping for comparison.
import { calmSceneAt, FLIGHT_SHARE, planScene, sceneAt } from "./scene.js";

/** A screen tall enough for the scene. A media query, so a phone's bars sliding away do not flip it. */
const FITS = "(min-height: 500px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const MOTION = "motion";
const TRUE = "true";
const LANDED = "landed";
const SMOOTH = "smooth";
const INSTANT = "instant";
const FLIGHT_PARAM = "flight";
const DIRECT = "direct";
const ROOTS_HASH = "#our-roots";
const ROOTS_TOP = "--roots-top";
const ROOTS_BOTTOM = "--roots-bottom";
/** The time, in milliseconds, for the shown progress to close most of the gap to the scroll: the glide's lag. */
const CHASE_MS = 140;
/** A frame longer than this (a background tab, a stall) is treated as this long, so the glide never leaps. */
const MAX_FRAME_MS = 50;
/** Close enough, in progress units, to count as arrived. */
const SETTLED = 0.0008;
/** The least opacity a layer is given: too faint to see, but enough to keep it painted. */
const PAINTED = 0.001;
/** The heart at the end of the scene: at most this share of the screen's width and height, and this many pixels tall. */
const END_WIDTH_SHARE = 0.86;
const END_HEIGHT_SHARE = 0.5;
const END_MAX_PX = 480;
/** The room, in pixels, between the heart and the words above and below it, and below the lowest words. */
const GAP_PX = 18;
const FOOT_PX = 30;

/** A hidden box as tall as the screen shows now (dvh: taller once a phone's bars slide away), for laying out the end. */
const SHOWN_SCREEN = "position:absolute;top:0;left:0;width:0;height:100dvh;visibility:hidden;pointer-events:none";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** A node's box relative to the camera. */
const boxIn = (node, base) => {
  const r = node.getBoundingClientRect();
  return { left: r.left - base.left, top: r.top - base.top, width: r.width, height: r.height };
};
const px = (v) => `${v.toFixed(2)}px`;

/**
 * @param {{
 *   opening: HTMLElement, camera: HTMLElement, village: HTMLElement, ring: HTMLElement, heart: HTMLElement,
 *   heroParts: Iterable<HTMLElement>, rootsParts: Iterable<HTMLElement>, links: Iterable<HTMLAnchorElement>
 * }} parts
 */
export function startScene(parts) {
  const { opening, camera, village, ring, heart, links } = parts;
  const heroParts = [...parts.heroParts];
  const rootsParts = [...parts.rootsParts];
  const [rootsTop, rootsBottom] = rootsParts;
  const turn = ring.closest(".mo-ring-turn");
  const shade = camera.querySelector(".mo-shade");
  const header = camera.querySelector(".site-header");
  const layers = [village, turn, heart];
  const screenNow = document.createElement("div");
  screenNow.style.cssText = SHOWN_SCREEN;
  screenNow.setAttribute("aria-hidden", "true");
  camera.append(screenNow);
  const fits = matchMedia(FITS);
  const reduced = matchMedia(REDUCED_MOTION);
  const direct = new URLSearchParams(location.search).get(FLIGHT_PARAM) === DIRECT;
  let plan = null;
  /** Each layer's top-left corner in the camera, and half the ring's side, for its turn. */
  let corners = [];
  let ringHalf = 0;
  let openingTop = 0;
  let flightPx = 1;
  let enabled = false;
  let frame = 0;
  let shown = 0;
  let lastFrame = 0;

  function rest() {
    delete opening.dataset[MOTION];
    for (const node of [...layers, ...heroParts, ...rootsParts, shade]) {
      node.style.opacity = "";
      node.style.transform = "";
      node.style.translate = "";
      node.style.visibility = "";
    }
    document.body.classList.remove(LANDED);
    plan = null;
  }

  function measure() {
    enabled = fits.matches;
    if (!enabled) {
      rest();
      return;
    }
    opening.dataset[MOTION] = TRUE;
    for (const node of layers) node.style.transform = "";
    const base = camera.getBoundingClientRect();
    // the camera is a large viewport tall, so a phone's bars sliding away never uncover the page below it; the heart's
    // end place is laid out in the screen as it shows now, and laid out again (resize) when the bars come or go
    const view = { width: base.width, height: Math.min(base.height, screenNow.offsetHeight || base.height) };
    corners = layers.map((node) => boxIn(node, base));
    ringHalf = corners[1].width / 2;
    const hero = corners[2];
    const start = { x: hero.left + hero.width / 2, y: hero.top + hero.height / 2 };
    // the heart at the end: as big as the screen allows once the words above and below it have their room
    const above = boxIn(header, base).top + header.offsetHeight + rootsTop.offsetHeight + GAP_PX * 2;
    const below = rootsBottom.offsetHeight + GAP_PX + FOOT_PX;
    const calm = reduced.matches;
    const tall = calm
      ? hero.height
      : Math.min(
          (view.width * END_WIDTH_SHARE * hero.height) / hero.width,
          view.height * END_HEIGHT_SHARE,
          END_MAX_PX,
          view.height - above - below,
        );
    const end = calm ? start : { x: view.width / 2, y: above + (view.height - above - below) / 2 };
    plan = planScene(start, end, Math.max(1, tall / hero.height));
    camera.style.setProperty(ROOTS_TOP, px(end.y - tall / 2 - GAP_PX));
    camera.style.setProperty(ROOTS_BOTTOM, px(end.y + tall / 2 + GAP_PX));
    openingTop = opening.getBoundingClientRect().top + window.scrollY;
    flightPx = Math.max(1, (opening.offsetHeight - camera.offsetHeight) * FLIGHT_SHARE);
    shown = progressNow();
    draw(shown);
  }

  const progressNow = () => clamp01((window.scrollY - openingTop) / flightPx);

  /** A layer grown `scale` times about the plan's fixed point, its transform counted from its top-left corner. */
  function grown(corner, scale) {
    const { anchor } = plan;
    return `translate3d(${px((scale - 1) * (corner.left - anchor.x))}, ${px((scale - 1) * (corner.top - anchor.y))}, 0) scale(${scale.toFixed(4)})`;
  }

  function show(nodes, opacity, drift) {
    for (const node of nodes) {
      node.style.opacity = opacity.toFixed(3);
      node.style.translate = drift ? `0 ${px(drift)}` : "";
      node.style.visibility = opacity > 0 ? "" : "hidden";
    }
  }

  /** Applies the scene at progress `p` to the page. */
  function draw(p) {
    const scene = reduced.matches ? calmSceneAt(p) : sceneAt(p, plan);
    const { scale } = scene;
    village.style.transform = grown(corners[0], scale);
    turn.style.transform = `${grown(corners[1], scale)} translate(${px(ringHalf)}, ${px(ringHalf)}) rotate(${scene.turnDeg.toFixed(2)}deg) translate(${px(-ringHalf)}, ${px(-ringHalf)})`;
    heart.style.transform = grown(corners[2], scale);
    village.style.opacity = scene.village.toFixed(3);
    turn.style.opacity = scene.ring.toFixed(3);
    heart.style.opacity = scene.heart.toFixed(3);
    shade.style.opacity = Math.max(PAINTED, scene.shade).toFixed(3);
    show(heroParts, scene.hero.opacity, scene.hero.drift);
    show(rootsParts, scene.roots.opacity, scene.roots.drift);
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

  /** Links into the scene scroll the track instead: the roots sit at the end of the zoom, the top at its start. */
  function jump(place, behavior) {
    if (!enabled) return false;
    window.scrollTo({ top: place === ROOTS_HASH ? openingTop + flightPx + 1 : openingTop, behavior });
    return true;
  }
  for (const link of links) {
    link.addEventListener("click", (event) => {
      if (jump(link.getAttribute("href"), SMOOTH)) event.preventDefault();
    });
  }

  // decoded ahead of the first frame that needs them, so the scene never waits on a picture
  for (const picture of layers.map((node) => (node === turn ? ring : node))) picture.decode?.().catch(() => undefined);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure);
  fits.addEventListener("change", measure);
  reduced.addEventListener("change", measure);
  // fonts and images move the words; measure again whenever the page changes height
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  if (document.fonts?.ready) document.fonts.ready.then(measure);
  window.addEventListener("load", () => {
    measure();
    if (location.hash === ROOTS_HASH) jump(ROOTS_HASH, INSTANT);
  });
  measure();
}
