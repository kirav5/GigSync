// The opening scene's timeline: what every part of the stage looks like at a given progress, as plain numbers.
// fly.js measures the page, chases the scroll and applies these numbers; nothing here touches the document.
//
// The scene plays like a zoom into a drawing. From progress 0 to 1 the hero copy and its frame fade away, and the hero
// mural grows evenly about its own centre while it slides to the middle of the stage, until it covers the whole
// stage, top bar included, fading as it grows into the same faint, shaded background as the jobs section. The roots
// print comes out of that drawing: it appears tiny at a fixed spot inside the mural while the mural is still bright,
// rides the zoom to its own place, and grows there from small to big, while the roots copy fades in beside it. The
// strip under the stage steps aside while the mural is bright and returns with the roots copy.

/** The share of the track beyond the camera that the scene takes; the rest holds the end state. Mirrors site.css. */
export const FLIGHT_SHARE = 200 / 230;
/** The roots print's tilt, as the stylesheet draws it. */
const ROOTS_TILT_DEG = -2;
/** The hero copy has faded by here, and the hero frame and caption a little sooner, before the mural covers them. */
const COPY_FADE_END = 0.2;
const FRAME_FADE_END = 0.14;
/** The mural has slid to the middle of the stage by here, and covers the stage by ZOOM_END, before it is faint. */
const ZOOM_CENTRED = 0.4;
const ZOOM_END = 0.5;
/** The mural fades over this stretch, down to the opacity of the mural behind the jobs section, as its shade comes up. */
const WASH_FADE_START = 0.04;
const WASH_FADE_END = 0.55;
const WASH_OPACITY = 0.1;
/** The roots print appears inside the mural here, this small beside its place in the drawing, and is solid soon after. */
const PRINT_START = 0.1;
const PRINT_SOLID = 0.46;
const PRINT_SEED = 0.16;
/** It has grown to its full size by here. */
const PRINT_GROWN = 0.84;
/** The roots copy fades in over this stretch. */
const ROOTS_COPY_START = 0.66;
const ROOTS_COPY_END = 0.96;
/** How far the copy drifts while it fades, in pixels. */
const DRIFT_PX = 26;
/** With Reduce Motion on: the hero fades away by here, then the print, then the roots copy, with nothing moving. */
const CALM_HERO_END = 0.4;
const CALM_PRINT_START = 0.42;
const CALM_PRINT_END = 0.72;
const CALM_COPY_START = 0.6;
const CALM_COPY_END = 0.96;

const smooth = (p) => p * p * (3 - 2 * p);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** Progress through the stretch from `from` to `to`, 0 before it and 1 after it. */
const stretch = (p, from, to) => clamp01((p - from) / (to - from));
const centreOf = (box) => ({ x: box.left + box.width / 2, y: box.top + box.height / 2 });

/**
 * @typedef {{ left: number, top: number, width: number, height: number }} Box
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ start: Box, stage: Box, from: Point, middle: Point, pivot: Point, cover: number }} Plan
 */

/**
 * The scene's fixed points, from boxes measured relative to the stage with the scene's own transforms removed.
 * @param {{ start: Box, art: Box, stage: Box }} boxes the hero picture, the roots print and the camera
 * @returns {Plan}
 */
export function planScene({ start, art, stage }) {
  return {
    start,
    stage,
    from: centreOf(start),
    middle: centreOf(stage),
    pivot: centreOf(art),
    // how much the hero picture must grow to cover the stage, as the mural behind the jobs section covers its own
    cover: Math.max(stage.width / start.width, stage.height / start.height),
  };
}

/**
 * The same scene for a reader who has asked for less motion: everything stays where it stands and only fades, because
 * a fade is what that setting allows and a zoom filling the screen is what it exists to stop.
 * @param {number} p
 * @param {Plan} plan
 */
export function calmSceneAt(p, plan) {
  const heroLeft = 1 - smooth(stretch(p, 0, CALM_HERO_END));
  const copyIn = smooth(stretch(p, CALM_COPY_START, CALM_COPY_END));
  return {
    heroCopy: { opacity: heroLeft, drift: 0 },
    heroFrame: heroLeft,
    rootsCopy: { opacity: copyIn, drift: 0 },
    strip: Math.max(heroLeft, copyIn),
    wash: {
      x: plan.from.x - plan.start.width / 2,
      y: plan.from.y - plan.start.height / 2,
      scale: 1,
      opacity: heroLeft,
    },
    shade: 0,
    print: {
      x: 0,
      y: 0,
      scale: 1,
      turnDeg: ROOTS_TILT_DEG,
      opacity: smooth(stretch(p, CALM_PRINT_START, CALM_PRINT_END)),
    },
    landed: p >= 1,
  };
}

/**
 * The whole scene at progress `p`: 0 is the hero, 1 the roots on the faded mural.
 * @param {number} p
 * @param {Plan} plan
 */
export function sceneAt(p, plan) {
  const copyLeft = 1 - smooth(stretch(p, 0, COPY_FADE_END));
  const copyIn = smooth(stretch(p, ROOTS_COPY_START, ROOTS_COPY_END));
  const shade = smooth(stretch(p, WASH_FADE_START, WASH_FADE_END));
  // the camera move: the mural slides to the middle of the stage while it grows, gently at both ends
  const slide = smooth(stretch(p, 0, ZOOM_CENTRED));
  const zoom = 1 - (1 - smooth(stretch(p, 0, ZOOM_END))) ** 2;
  const scale = lerp(1, plan.cover, zoom);
  const centre = { x: lerp(plan.from.x, plan.middle.x, slide), y: lerp(plan.from.y, plan.middle.y, slide) };
  // the roots print belongs to the drawing: its own place on the finished stage is a spot in the mural, and this is
  // where that spot sits at this moment of the zoom, and how much smaller the drawing is than it will be
  const shrink = scale / plan.cover;
  const spot = {
    x: centre.x + shrink * (plan.pivot.x - plan.middle.x),
    y: centre.y + shrink * (plan.pivot.y - plan.middle.y),
  };
  // it grows out of that spot: small at first beside the drawing around it, its full share of it by the end
  const size = shrink * lerp(PRINT_SEED, 1, smooth(stretch(p, PRINT_START, PRINT_GROWN)));
  return {
    heroCopy: { opacity: copyLeft, drift: -DRIFT_PX * (1 - copyLeft) },
    heroFrame: 1 - stretch(p, 0, FRAME_FADE_END),
    rootsCopy: { opacity: copyIn, drift: DRIFT_PX * (1 - copyIn) },
    strip: Math.max(copyLeft, copyIn),
    /** The hero mural: a box of the hero picture's size, moved, scaled and faded. */
    wash: {
      x: centre.x - plan.start.width / 2,
      y: centre.y - plan.start.height / 2,
      scale,
      opacity: lerp(1, WASH_OPACITY, shade),
    },
    /** The shade over the mural, as over the mural behind the jobs section. */
    shade,
    /** The roots print, tilted: how far it is moved from its own place, and how small it is drawn. */
    print: {
      x: spot.x - plan.pivot.x,
      y: spot.y - plan.pivot.y,
      scale: size,
      turnDeg: ROOTS_TILT_DEG,
      opacity: smooth(stretch(p, PRINT_START, PRINT_SOLID)),
    },
    landed: p >= 1,
  };
}
