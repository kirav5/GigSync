// The folk strip from the header, laid along the curved edge of each hill (flow.css draws the hills). Every hill's top
// is half an ellipse as wide and as tall as the hill box, so the strip is a row of the same small triangles set at equal
// steps along that arc, each turned to follow it, with the strip's hairline drawn along the same arc just inside them.
// The strip is drawn into an SVG inside the hill, so it rises and sets with it, and redrawn whenever the hill resizes.

const SVG_NS = "http://www.w3.org/2000/svg";
/** One tile of the strip, the same shape as the header's: a triangle within a triangle, a dot at the joint. */
const TILE = '<path d="M2 15 18 2l16 13H2Zm8-2 8-7 8 7Z"/><circle cx="0" cy="5" r="1" stroke="none"/>';
/** The tile's width in its own units and on the page, matching the header strip (36 drawn at 28). */
const TILE_UNITS = 36;
const TILE_PX = 28;
/** How far inside the hill's edge the strip's baseline runs, in pixels. */
const INSET = 26;
/** Arc samples used to measure the curve's length before stepping along it. */
const SAMPLES = 720;

/** The point at parameter t (0 = right end, PI = left end) of the hill's arc. */
function arcAt(t, a, b, inset) {
  return { x: a + (a - inset) * Math.cos(t), y: b - (b - inset) * Math.sin(t) };
}

function draw(hill) {
  // exact sizes, not whole pixels: the hill's height moves by fractions of a pixel as it pulls up
  const { width: w, height: h } = hill.getBoundingClientRect();
  if (!w || !h) return;
  const a = w / 2;
  const b = h;
  const svg = hill.querySelector("svg") ?? hill.appendChild(document.createElementNS(SVG_NS, "svg"));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("preserveAspectRatio", "none");
  // walk the arc once to know its length, then step a tile at a time
  const points = [];
  let length = 0;
  let last = arcAt(0, a, b, INSET);
  for (let i = 0; i <= SAMPLES; i++) {
    const p = arcAt((Math.PI * i) / SAMPLES, a, b, INSET);
    length += Math.hypot(p.x - last.x, p.y - last.y);
    points.push({ ...p, s: length });
    last = p;
  }
  const scale = TILE_PX / TILE_UNITS;
  const tiles = [];
  let k = 0;
  // tiles are counted out from the top of the arch, so as the curve pulls up and its length changes they stay put at
  // the middle instead of all sliding along from one end; each sits at its exact place between two samples
  for (let s = (length / 2) % TILE_PX; s < length; s += TILE_PX) {
    while (k < points.length - 2 && points[k + 1].s < s) k++;
    const p = points[k];
    const q = points[k + 1];
    const f = (s - p.s) / (q.s - p.s || 1);
    const x = p.x + (q.x - p.x) * f;
    const y = p.y + (q.y - p.y) * f;
    const angle = (Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI;
    tiles.push(
      `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(2)}) scale(${scale}) translate(${-TILE_UNITS / 2} -18)">${TILE}</g>`,
    );
  }
  const line = (inset) => {
    const r = (v) => v.toFixed(2);
    return `<path class="strip-line" fill="none" d="M${r(inset)} ${r(b)} A${r(a - inset)} ${r(b - inset)} 0 0 1 ${r(w - inset)} ${r(b)}"/>`;
  };
  svg.innerHTML = `${line(INSET)}${line(INSET + 10)}${tiles.join("")}`;
}

/** Lays the strip along each hill and keeps it fitted as the hills resize. */
export function curveStrips(hills) {
  const watch = new ResizeObserver((entries) => {
    for (const e of entries) draw(e.target);
  });
  for (const hill of hills) {
    draw(hill);
    watch.observe(hill);
  }
}
