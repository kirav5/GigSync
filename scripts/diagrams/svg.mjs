// Tiny SVG helpers for GigSync's architecture diagrams, in Collab's look: off-white canvas, hairline boxes, mono
// labels, one pink accent. Each diagram is plain data in gigsync.mjs; `node scripts/diagrams/gigsync.mjs` redraws them.

export const INK = "#0a0a0a";
export const TEXT2 = "#55554f";
export const TEXT3 = "#6b6b66";
export const HAIR = "#cfcfc9";
export const SURFACE = "#ffffff";
export const BG = "#f7f7f5";
export const ACCENT = "#c4126e";
export const ACCENT_FILL = "#ffe4f1";
export const FRESH = "#087a45";
export const FRESH_FILL = "#e2f4ea";
export const PERI = "#4a4ec4";
export const PERI_FILL = "#e6e7fb";
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Box styles: person (pink), app (ink), cloud (dashed), ext (grey), private (periwinkle), ok (green). */
const STYLE = {
  person: { stroke: ACCENT, fill: ACCENT_FILL, dash: "" },
  app: { stroke: INK, fill: SURFACE, dash: "" },
  cloud: { stroke: TEXT3, fill: SURFACE, dash: "6 4" },
  ext: { stroke: HAIR, fill: "#efefec", dash: "" },
  private: { stroke: PERI, fill: PERI_FILL, dash: "" },
  ok: { stroke: FRESH, fill: FRESH_FILL, dash: "" },
};

export function text(x, y, s, { size = 13, color = INK, weight = 400, mono = false, anchor = "start" } = {}) {
  const family = mono ? MONO : SANS;
  const spacing = mono ? ' letter-spacing="0.06em"' : "";
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}"${spacing}>${esc(s)}</text>`;
}

/** A box with a bold title and up to a few lines of smaller text under it. */
export function box(x, y, w, h, title, lines = [], kind = "app") {
  const s = STYLE[kind];
  const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : "";
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.2"${dash}/>`,
    text(x + 12, y + 22, title, { size: 14, weight: 600 }),
  ];
  lines.forEach((l, i) => {
    parts.push(text(x + 12, y + 41 + i * 17, l, { size: 12, color: TEXT2 }));
  });
  return parts.join("");
}

/** A labelled group around boxes: a hairline frame with a mono caption. */
export function group(x, y, w, h, caption, dashed = false) {
  const dash = dashed ? ' stroke-dasharray="6 4"' : "";
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="none" stroke="${TEXT3}" stroke-width="1"${dash}/>`,
    text(x + 14, y + 22, caption.toUpperCase(), { size: 11, color: TEXT3, mono: true }),
  ].join("");
}

/** An arrow from (x1,y1) to (x2,y2), with an optional label above its middle. */
export function arrow(x1, y1, x2, y2, label = "", { dashed = false, both = false, color = INK, dx = 0, dy = -7 } = {}) {
  const dash = dashed ? ' stroke-dasharray="5 4"' : "";
  const start = both ? ' marker-start="url(#tail)"' : "";
  const parts = [
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.3"${dash} marker-end="url(#head)"${start}/>`,
  ];
  if (label)
    parts.push(text((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, label, { size: 12, color: TEXT2, anchor: "middle" }));
  return parts.join("");
}

/** A note band, e.g. a step that happens on one phone. */
export function note(x, y, w, h, s, kind = "person") {
  const st = STYLE[kind];
  return [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${st.fill}" stroke="${st.stroke}" stroke-width="1"/>`,
    text(x + w / 2, y + h / 2 + 4, s, { size: 12, anchor: "middle" }),
  ].join("");
}

/** Sequence diagram lanes: a header box per participant and a dashed lifeline under it. */
export function lanes(names, xs, top, bottom) {
  return names
    .map((n, i) => {
      const x = xs[i];
      return [
        `<rect x="${x - 95}" y="${top}" width="190" height="40" rx="6" fill="${SURFACE}" stroke="${INK}" stroke-width="1.2"/>`,
        text(x, top + 25, n, { size: 13, weight: 600, anchor: "middle" }),
        `<line x1="${x}" y1="${top + 40}" x2="${x}" y2="${bottom}" stroke="${HAIR}" stroke-width="1.2" stroke-dasharray="4 4"/>`,
      ].join("");
    })
    .join("");
}

/** The whole SVG document, with arrowheads defined once. */
export function svg(width, height, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs>
<marker id="head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="${INK}"/></marker>
<marker id="tail" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="${INK}"/></marker>
</defs>
<rect width="${width}" height="${height}" fill="${BG}"/>
${text(24, 34, title, { size: 18, weight: 650 })}
${body}
</svg>
`;
}
