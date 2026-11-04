// The hero mural glides into the smaller frame of the roots section as the page scrolls. One fixed element
// carries the picture from the hero frame to the roots window, shrinking on the way, and hands over to the real
// image in the roots frame once it has landed. Phones and reduced-motion settings get the two images in place,
// no flight.
const DESKTOP = "(min-width: 800px)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const LANDED = "landed";
const FLYING = "flying";
const BLOCK = "block";
const NONE = "none";
/** How far into the flight the hero frame and caption have fully faded. */
const FRAME_FADE_END = 0.35;

const smooth = (p) => p * p * (3 - 2 * p);
const lerp = (a, b, t) => a + (b - a) * t;
const docRect = (node) => {
  const r = node.getBoundingClientRect();
  return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height };
};

export function startHeroFlight({ heroArt, heroFrame, heroCaption, rootsWindow, fly }) {
  const desktop = matchMedia(DESKTOP);
  const reduced = matchMedia(REDUCED_MOTION);
  let start = null;
  let end = null;
  let endScroll = 0;
  let enabled = false;
  let frame = 0;

  function rest() {
    fly.style.display = NONE;
    document.body.classList.remove(FLYING, LANDED);
    heroFrame.style.opacity = "";
    heroCaption.style.opacity = "";
  }

  function measure() {
    enabled = desktop.matches && !reduced.matches;
    if (!enabled) {
      rest();
      return;
    }
    document.body.classList.add(FLYING);
    start = docRect(heroArt);
    end = docRect(rootsWindow);
    // the picture has landed once the roots frame sits in the middle of the viewport
    endScroll = end.top - (window.innerHeight - end.height) / 2;
    render();
  }

  function render() {
    frame = 0;
    if (!enabled || !start || !end || endScroll <= 0) return;
    const p = Math.min(1, Math.max(0, window.scrollY / endScroll));
    const fade = 1 - Math.min(1, p / FRAME_FADE_END);
    heroFrame.style.opacity = String(fade);
    heroCaption.style.opacity = String(fade);
    if (p >= 1) {
      document.body.classList.add(LANDED);
      fly.style.display = NONE;
      return;
    }
    document.body.classList.remove(LANDED);
    const t = smooth(p);
    const left = lerp(start.left, end.left, t) - window.scrollX;
    const top = lerp(start.top, end.top, t) - window.scrollY;
    fly.style.display = BLOCK;
    fly.style.width = `${lerp(start.width, end.width, t)}px`;
    fly.style.height = `${lerp(start.height, end.height, t)}px`;
    fly.style.transform = `translate3d(${left}px, ${top}px, 0)`;
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(render);
  };
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", measure);
  desktop.addEventListener("change", measure);
  reduced.addEventListener("change", measure);
  // fonts, images and opened details all move the roots frame; measure again whenever the page changes height
  if ("ResizeObserver" in window) new ResizeObserver(measure).observe(document.body);
  if (document.fonts?.ready) document.fonts.ready.then(measure);
  window.addEventListener("load", measure);
  measure();
}
