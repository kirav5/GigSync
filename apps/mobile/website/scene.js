// The opening scene's timeline: what every layer of the circle looks like at a given progress, as plain numbers.
// fly.js measures the page, chases the scroll and applies these numbers; nothing here touches the document.
//
// The scene is one zoom into the mural. At progress 0 the ring of dancers stands bright around the headline, with the
// village faint behind it and the heart, two women holding one basket, a ghost at its centre. As the reader scrolls,
// every layer grows about one fixed point, the same factor for all of them, so the drawing stays whole: the headline
// fades, the ring swells past the edges of the screen and fades into the faint background, and the heart brightens and
// grows until it fills the middle of the screen with the roots copy around it. Nothing slides and the background
// colour never changes. The fixed point is chosen so the heart ends in the middle of the room the roots copy leaves.

/** The share of the track beyond the camera that the scene takes; the rest holds the end state. Mirrors opening.css. */
export const FLIGHT_SHARE = 170 / 190;
/** The hero copy has faded by here, and the pool of shade inside the ring a little later. */
const HERO_FADE_END = 0.22;
const SHADE_FADE_END = 0.4;
/** The zoom runs over this stretch, and the ring turns this much further while it does. */
const ZOOM_START = 0.03;
const ZOOM_END = 0.9;
const RING_TURN_DEG = 28;
/** The ring and the village fade to these, the level of the mural behind the jobs section, over these stretches. */
const RING = { from: 0.92, to: 0.11, start: 0.08, end: 0.72 };
const VILLAGE = { from: 0.11, to: 0.07, start: 0.1, end: 0.8 };
/** The heart comes up from a ghost to bright. */
const HEART = { from: 0.1, to: 0.95, start: 0.18, end: 0.66 };
/** The roots copy fades in over this stretch, drifting this many pixels as it comes. */
const ROOTS_START = 0.68;
const ROOTS_END = 0.97;
const DRIFT_PX = 22;
/** With Reduce Motion on nothing grows or turns; the same layers only fade, in this order. */
const CALM = {
  hero: 0.35,
  ring: { start: 0.25, end: 0.65 },
  heart: { start: 0.3, end: 0.7 },
  roots: { start: 0.6, end: 0.95 },
};

const smooth = (p) => p * p * (3 - 2 * p);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
/** Progress through the stretch from `from` to `to`, 0 before it and 1 after it. */
const stretch = (p, from, to) => clamp01((p - from) / (to - from));
const fadeOf = (p, f, start = f.start, end = f.end) => lerp(f.from, f.to, smooth(stretch(p, start, end)));

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ grow: number, anchor: Point }} Plan
 */

/**
 * The zoom's size and fixed point: the heart's centre goes from where the hero draws it to `end`, `grow` times bigger.
 * Every point of the drawing moves along the line from the fixed point, so the heart's path is a straight one.
 * @param {Point} start the heart's centre in the hero
 * @param {Point} end its centre at the end of the scene
 * @param {number} grow how many times bigger it ends
 * @returns {Plan}
 */
export function planScene(start, end, grow) {
  if (grow < 1.001) return { grow: 1, anchor: start };
  const at = (a, b) => (grow * a - b) / (grow - 1);
  return { grow, anchor: { x: at(start.x, end.x), y: at(start.y, end.y) } };
}

/**
 * The whole scene at progress `p`: 0 is the hero, 1 the roots around the heart.
 * @param {number} p
 * @param {Plan} plan
 */
export function sceneAt(p, plan) {
  const heroLeft = 1 - smooth(stretch(p, 0, HERO_FADE_END));
  const rootsIn = smooth(stretch(p, ROOTS_START, ROOTS_END));
  const zoom = smooth(stretch(p, ZOOM_START, ZOOM_END));
  return {
    hero: { opacity: heroLeft, drift: -DRIFT_PX * (1 - heroLeft) },
    shade: 1 - smooth(stretch(p, 0, SHADE_FADE_END)),
    // growth by a constant ratio per step of scroll reads as an even camera move, where a linear one would rush at first
    scale: plan.grow ** zoom,
    turnDeg: RING_TURN_DEG * zoom,
    village: fadeOf(p, VILLAGE),
    ring: fadeOf(p, RING),
    heart: fadeOf(p, HEART),
    roots: { opacity: rootsIn, drift: DRIFT_PX * (1 - rootsIn) },
    landed: p >= 1,
  };
}

/**
 * The same scene for a reader who has asked for less motion: nothing grows, turns or drifts; the layers only fade.
 * @param {number} p
 */
export function calmSceneAt(p) {
  const heroLeft = 1 - smooth(stretch(p, 0, CALM.hero));
  return {
    hero: { opacity: heroLeft, drift: 0 },
    shade: heroLeft,
    scale: 1,
    turnDeg: 0,
    village: VILLAGE.from,
    ring: fadeOf(p, RING, CALM.ring.start, CALM.ring.end),
    heart: fadeOf(p, HEART, CALM.heart.start, CALM.heart.end),
    roots: { opacity: smooth(stretch(p, CALM.roots.start, CALM.roots.end)), drift: 0 },
    landed: p >= 1,
  };
}
