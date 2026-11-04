// The sun mark on the "final" site: concentric rings with a filled core and twelve small triangular rays, in the
// current text colour. Drawn in code so it scales with the brand and stays GigSync's own.
const NS = "http://www.w3.org/2000/svg";
const RAYS = 12;
const C = 32;

const el = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};
const polar = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
const pt = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

export function drawSunMark(svg) {
  const g = el("g", { fill: "none", stroke: "currentColor", "stroke-width": 1.2 });
  for (const r of [18, 14, 9]) g.appendChild(el("circle", { cx: C, cy: C, r }));
  g.appendChild(el("circle", { cx: C, cy: C, r: 4, fill: "currentColor" }));
  const rays = [];
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2;
    const tip = polar(29, a);
    const base1 = polar(21, a - 0.1);
    const base2 = polar(21, a + 0.1);
    rays.push(`M${pt(base1)}L${pt(tip)}L${pt(base2)}Z`);
  }
  g.appendChild(el("path", { d: rays.join("") }));
  svg.appendChild(g);
}
