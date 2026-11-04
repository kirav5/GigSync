// The two folk-art scenes inside the "She says it. It's done." cards, drawn in the mural's hand (ivory strokes on
// earth): a woman speaking her work into her phone, and her and the household joined over a signed receipt and
// the payment. Built from a few primitives so no long path data lives in the page.
const NS = "http://www.w3.org/2000/svg";
const KANNADA = "'Noto Sans Kannada', sans-serif";
const SUN_RAYS = 14;
const GROUND_Y = 262;

const el = (name, attrs) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};
const path = (g, d, attrs = {}) => g.appendChild(el("path", { d, ...attrs }));

/** A Warli figure: head, hourglass body, legs; `bun` marks a woman. Returns the shoulder points for arms. */
function figure(g, x, top, h, bun) {
  const head = top + h * 0.09;
  g.appendChild(el("circle", { cx: x, cy: head, r: h * 0.085 }));
  if (bun) g.appendChild(el("circle", { cx: x + h * 0.11, cy: head - h * 0.03, r: h * 0.04 }));
  const sh = top + h * 0.22;
  const waist = top + h * 0.47;
  const hip = top + h * 0.66;
  const w = h * 0.26;
  path(g, `M${x - w / 2} ${sh}h${w}L${x} ${waist}zM${x} ${waist}L${x - w * 0.62} ${hip}h${w * 1.24}z`);
  path(g, `M${x - w * 0.3} ${hip}L${x - w * 0.42} ${top + h}M${x + w * 0.3} ${hip}L${x + w * 0.42} ${top + h}`);
  return { left: [x - w / 2, sh], right: [x + w / 2, sh] };
}

function sun(g, cx, cy, r) {
  g.appendChild(el("circle", { cx, cy, r }));
  const rays = [];
  for (let i = 0; i < SUN_RAYS; i++) {
    const a = (i / SUN_RAYS) * Math.PI * 2;
    const r1 = r + 5;
    const r2 = r + (i % 2 ? 11 : 15);
    rays.push(
      `M${(cx + r1 * Math.cos(a)).toFixed(1)} ${(cy + r1 * Math.sin(a)).toFixed(1)}L${(cx + r2 * Math.cos(a)).toFixed(1)} ${(cy + r2 * Math.sin(a)).toFixed(1)}`,
    );
  }
  path(g, rays.join(""));
}

function house(g, x, y, w, h) {
  path(g, `M${x} ${y}h${w}v${h}H${x}zM${x - 6} ${y}L${x + w / 2} ${y - h * 0.55}L${x + w + 6} ${y}`);
  path(g, `M${x + w * 0.4} ${y + h}v${-h * 0.42}h${w * 0.2}v${h * 0.42}`);
  path(g, `M${x + w * 0.12} ${y + h * 0.18}h${w * 0.18}v${h * 0.18}h${-w * 0.18}z`);
}

function ground(g, x1, x2) {
  const dots = el("g", { fill: "currentColor", stroke: "none" });
  for (let x = x1; x <= x2; x += 10)
    dots.appendChild(el("circle", { cx: x, cy: GROUND_Y + ((x / 10) % 2) * 3, r: 1.5 }));
  g.appendChild(dots);
  const tufts = [];
  for (let x = x1 + 8; x <= x2; x += 44)
    tufts.push(`M${x} ${GROUND_Y - 6}l-5-10M${x} ${GROUND_Y - 6}v-13M${x} ${GROUND_Y - 6}l5-10`);
  path(g, tufts.join(""), { "stroke-width": 1.5 });
}

function birds(g, x, y) {
  path(g, `M${x} ${y}q7-7 14 0q-7-3-14 0M${x + 24} ${y - 8}q6-6 12 0q-6-3-12 0`, { "stroke-width": 1.5 });
}

function start(svg) {
  const g = el("g", {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(g);
  return g;
}

/** She speaks her work into her phone; the words rise in a bubble, in Kannada. */
export function drawSayScene(svg) {
  const g = start(svg);
  sun(g, 340, 52, 18);
  birds(g, 56, 44);
  house(g, 262, 164, 84, 66);
  ground(g, 20, 380);
  const { left, right } = figure(g, 110, 108, 152, true);
  path(g, `M${left[0]} ${left[1]}L74 176`);
  path(g, `M${right[0]} ${right[1]}L154 134`);
  g.appendChild(el("rect", { x: 148, y: 108, width: 15, height: 28, rx: 3 }));
  path(g, "M174 110a14 14 0 0 1 0 26M182 102a24 24 0 0 1 0 42", { "stroke-width": 1.6 });
  path(g, "M196 62h100a8 8 0 0 1 8 8v46a8 8 0 0 1-8 8h-76l-16 14 5-14h-13a8 8 0 0 1-8-8V70a8 8 0 0 1 8-8z");
  const words = el("text", {
    x: 246,
    y: 100,
    "text-anchor": "middle",
    "font-family": KANNADA,
    "font-size": 20,
    fill: "currentColor",
    stroke: "none",
  });
  words.textContent = "ಕೆಲಸ ಬೇಕು";
  g.appendChild(words);
}

/** She and the household hold hands beneath a signed receipt; the payment is on its way to her. */
export function drawDoneScene(svg) {
  const g = start(svg);
  sun(g, 60, 52, 18);
  birds(g, 300, 40);
  house(g, 44, 164, 84, 66);
  ground(g, 20, 380);
  const her = figure(g, 176, 108, 152, true);
  const them = figure(g, 256, 108, 152, false);
  path(
    g,
    `M${her.left[0]} ${her.left[1]}L140 176M${her.right[0]} ${her.right[1]}L216 170M${them.left[0]} ${them.left[1]}L216 170M${them.right[0]} ${them.right[1]}L292 176`,
  );
  g.appendChild(el("circle", { cx: 216, cy: 170, r: 4, fill: "currentColor", stroke: "none" }));
  g.appendChild(el("rect", { x: 190, y: 44, width: 52, height: 66, rx: 3 }));
  path(g, "M200 60h32M200 72h32M200 84h20", { "stroke-width": 1.6 });
  g.appendChild(el("circle", { cx: 230, cy: 96, r: 8 }));
  path(g, "M226 96l3 3 6-7", { "stroke-width": 1.8 });
  g.appendChild(el("circle", { cx: 328, cy: 118, r: 12 }));
  const rupee = el("text", {
    x: 328,
    y: 123,
    "text-anchor": "middle",
    "font-family": KANNADA,
    "font-size": 14,
    fill: "currentColor",
    stroke: "none",
  });
  rupee.textContent = "₹";
  g.appendChild(rupee);
  path(g, "M312 126l-14 10M306 118l-16 8M304 134l-12 12", { "stroke-width": 1.5 });
}
