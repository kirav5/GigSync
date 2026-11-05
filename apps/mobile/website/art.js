// The logo mark on the website, taken from the mural: a circle of eight people holding hands around a tree.
// Drawn in code so it scales with the brand and stays GigSync's own.
const NS = "http://www.w3.org/2000/svg";
const DANCERS = 8;
const C = 32;

const el = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

/** One dancer standing at twelve o'clock, feet toward the centre: head, hourglass body, arms out to the neighbours. */
const DANCER =
  "M29 12.2h6l-3 3zM32 15.2l-2.75 3.6h5.5zM30.1 18.8 29 22.2M33.9 18.8 35 22.2M29 12.2l-3.6 1.9M35 12.2l3.6 1.9";

/** The logo mark: a ring of dancers holding hands around a tree, inside one thin circle. */
export function drawLogoMark(svg) {
  const g = el("g", {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.3,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  g.appendChild(el("circle", { cx: C, cy: C, r: 28.5, "stroke-width": 0.9 }));
  for (let i = 0; i < DANCERS; i++) {
    const turn = el("g", { transform: `rotate(${(i * 360) / DANCERS} ${C} ${C})` });
    turn.appendChild(el("circle", { cx: C, cy: 9.6, r: 1.7 }));
    turn.appendChild(el("path", { d: DANCER }));
    g.appendChild(turn);
  }
  // the tree: trunk, two branches and a crown of dots
  g.appendChild(el("path", { d: "M32 41V29M32 35l-5-5M32 35l5-5" }));
  const crown = el("g", { fill: "currentColor", stroke: "none" });
  for (const [x, y] of [
    [32, 23.5],
    [28.6, 25.8],
    [35.4, 25.8],
    [30, 28.8],
    [34, 28.8],
    [32, 26.6],
  ]) {
    crown.appendChild(el("circle", { cx: x, cy: y, r: 1.25 }));
  }
  g.appendChild(crown);
  svg.appendChild(g);
}
