// The folk-art drawings on the "circle" site, built from simple shapes so no long path data lives in the page:
// a sun mark, a ring of figures, and the mural (a circle of people holding hands beneath a tree, with homes and
// a sun, in ivory on earth brown). Everything is GigSync's own.
const NS = "http://www.w3.org/2000/svg";
const RAYS = 12;
const RING_FIGURES = 14;
const CANOPY_DOTS = 90;
const BORDER_STEP = 24;

const el = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

/** A triangle-bodied figure facing `dir` (+1 right, -1 left), arms out; hands end at (x±arm, y+8). */
function figurePath(x, y, size, dir) {
  const h = size;
  const w = size * 0.55;
  const arm = size * 0.7;
  const head = `M${x} ${y - h * 0.18}a${h * 0.14} ${h * 0.14} 0 1 0 .1 0`;
  const body = `M${x} ${y}l${-w / 2} ${h * 0.55}h${w}zM${x - w * 0.35} ${y + h * 0.55}l${-w * 0.35} ${h * 0.7}h${w * 1.4}z`;
  const arms = `M${x} ${y + h * 0.12}l${-arm} ${h * 0.14}M${x} ${y + h * 0.12}l${arm} ${h * 0.14}`;
  const legs = `M${x - w * 0.3} ${y + h * 1.25}l${-w * 0.25 * dir} ${h * 0.4}M${x + w * 0.3} ${y + h * 1.25}l${w * 0.25 * dir} ${h * 0.4}`;
  return head + body + arms + legs;
}

/** The sun mark's rays around the brand's circle. */
export function drawRays(path) {
  const parts = [];
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2;
    const [x1, y1] = polar(20, 20, 9, a);
    const [x2, y2] = polar(20, 20, i % 2 ? 14 : 17, a);
    parts.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  path.setAttribute("d", parts.join(""));
}

/** Small figures standing on a ring, for the quiet mark beside "Rooted & reaching". */
export function drawRingFigures(path) {
  const parts = [];
  for (let i = 0; i < RING_FIGURES; i++) {
    const a = (i / RING_FIGURES) * Math.PI * 2;
    const [x, y] = polar(60, 60, 37, a);
    parts.push(`M${x.toFixed(1)} ${y.toFixed(1)}m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0`);
  }
  path.setAttribute("d", parts.join(""));
}

/** The mural: border, sun, tree, a ring of figures holding hands, homes, a bird and two small scenes. */
export function drawMural(svg) {
  const g = el("g", {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(g);
  // border of small triangles
  const border = [];
  for (let x = 24; x <= 576; x += BORDER_STEP) {
    border.push(`M${x} 16l6 10h-12zM${x} 584l6-10h-12z`);
  }
  for (let y = 40; y <= 560; y += BORDER_STEP) {
    border.push(`M16 ${y}l10 6v-12zM584 ${y}l-10 6v-12z`);
  }
  g.appendChild(el("path", { d: border.join("") }));
  // sun
  g.appendChild(el("circle", { cx: 505, cy: 95, r: 22 }));
  const sun = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const [x1, y1] = polar(505, 95, 28, a);
    const [x2, y2] = polar(505, 95, 40, a);
    sun.push(`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  g.appendChild(el("path", { d: sun.join("") }));
  // tree: trunk, branches and a dotted canopy
  g.appendChild(el("path", { d: "M300 300V190M300 230l-40-40M300 230l40-40M300 205l-22-30M300 205l22-30M286 300h28" }));
  const canopy = el("g", { fill: "currentColor", stroke: "none" });
  for (let i = 0; i < CANOPY_DOTS; i++) {
    const a = (i * 2.399963) % (Math.PI * 2);
    const r = 14 + Math.sqrt(i / CANOPY_DOTS) * 72;
    const [x, y] = polar(300, 150, r, a);
    if (y < 215) canopy.appendChild(el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 2.6 }));
  }
  g.appendChild(canopy);
  // ring of figures holding hands
  const ring = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = polar(300, 380, 118, a);
    ring.push(figurePath(x, y - 22, 26, i % 2 ? 1 : -1));
  }
  g.appendChild(el("path", { d: ring.join("") }));
  g.appendChild(el("circle", { cx: 300, cy: 380, r: 150, "stroke-dasharray": "2 7" }));
  // homes
  g.appendChild(
    el("path", {
      d: "M70 470h70v60H70zM62 470l43-36 43 36M96 500h18v30h-18zM460 470h70v60h-70zM452 470l43-36 43 36M486 500h18v30h-18z",
    }),
  );
  // a bird and a pot carrier, a bullock
  g.appendChild(el("path", { d: "M120 110q14-12 28 0q-14-6-28 0M148 108q10-8 20 0" }));
  g.appendChild(el("path", { d: figurePath(110, 320, 30, 1) + "M110 304m-9 0h18l-3-10h-12z" }));
  g.appendChild(
    el("path", {
      d: "M470 350h60l10 14h-80zM480 364l-4 22M520 364l4 22M470 350l-12-16M530 350l12-16M458 334l-8-6M542 334l8-6",
    }),
  );
  // figures with tools at the sides
  g.appendChild(el("path", { d: figurePath(80, 220, 28, -1) + "M62 230l-12 36" }));
  g.appendChild(el("path", { d: figurePath(520, 230, 28, 1) + "M538 240l14 30" }));
  // an inner ring of smaller dancers, facing the other way
  const inner = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2 + Math.PI / 12;
    const [x, y] = polar(300, 380, 66, a);
    inner.push(figurePath(x, y - 14, 17, i % 2 ? -1 : 1));
  }
  g.appendChild(el("path", { d: inner.join("") }));
  g.appendChild(el("circle", { cx: 300, cy: 380, r: 90, "stroke-dasharray": "1 6" }));
  // a flock of birds, palms, grass tufts and a dotted ground
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const x = 150 + i * 26 + (i % 2) * 8;
    const y = 70 + (i % 3) * 9;
    birds.push(`M${x} ${y}q7-7 14 0q-7-3-14 0`);
  }
  g.appendChild(el("path", { d: birds.join("") }));
  g.appendChild(
    el("path", {
      d: "M60 400v-60M60 340c-14 2-22-6-22-16 12-2 20 4 22 16zM60 340c14 2 22-6 22-16-12-2-20 4-22 16zM60 352c-12 6-24 2-28-8 12-4 22 0 28 8zM60 352c12 6 24 2 28-8-12-4-22 0-28 8zM540 400v-60M540 340c-14 2-22-6-22-16 12-2 20 4 22 16zM540 340c14 2 22-6 22-16-12-2-20 4-22 16zM540 352c-12 6-24 2-28-8 12-4 22 0 28 8zM540 352c12 6 24 2 28-8-12-4-22 0-28 8z",
    }),
  );
  const ground = el("g", { fill: "currentColor", stroke: "none" });
  for (let x = 40; x <= 560; x += 10) ground.appendChild(el("circle", { cx: x, cy: 552 + ((x / 10) % 2) * 4, r: 1.6 }));
  g.appendChild(ground);
  const tufts = [];
  for (let x = 48; x <= 552; x += 36) tufts.push(`M${x} 544l-5-10M${x} 544v-13M${x} 544l5-10`);
  g.appendChild(el("path", { d: tufts.join("") }));
}
