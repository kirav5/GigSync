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
  const w = hill.clientWidth;
  const h = hill.clientHeight;
  if (!w || !h) return;
  const a = w / 2;
  const b = h;
  const svg = hill.querySelector("svg") ?? hill.appendChild(document.createElementNS(SVG_NS, "svg"));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
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
  for (let s = TILE_PX / 2; s < length; s += TILE_PX) {
    while (k < points.length - 1 && points[k + 1].s < s) k++;
    const p = points[k];
    const q = points[Math.min(k + 1, points.length - 1)];
    const angle = (Math.atan2(p.y - q.y, p.x - q.x) * 180) / Math.PI;
    tiles.push(
      `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${angle.toFixed(2)}) scale(${scale}) translate(${-TILE_UNITS / 2} -18)">${TILE}</g>`,
    );
  }
  const line = (inset) => {
    const r = (v) => v.toFixed(1);
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
