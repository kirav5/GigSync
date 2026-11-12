/**
 * Line icons on a 24px grid, one path each, stroked in the text colour by `.ic` (styles.css): 1.7 wide with round caps
 * and joins, as the app-journey design draws them (its kit.js `I` set, circles and boxes turned into arcs and lines).
 * Circles are two half arcs, `M x-r y a r r 0 1 0 2r 0 a r r 0 1 0 -2r 0`, so each icon stays a single path.
 */
const PATHS = {
  home: "M4 11 12 4l8 7v9H4zM10 20v-6h4v6",
  jobs: "M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM9 7V5h6v2M3 12h18",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 19h1.5M19 14v1.5",
  book: "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM8 7h8",
  chat: "M4 5h16v10H9l-5 4z",
  user: "M8 8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 21c0-4 4-6 8-6s8 2 8 6",
  lock: "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM8 11V8a4 4 0 0 1 8 0v3",
  check: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 12l3 3 5-6",
  rupee: "M7 5h10M7 9h10M10 5c4 0 5 2 5 4s-1 4-5 4H7l7 7",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  phone: "M6.5 2.5h11v19h-11zM11 18h2",
  wall: "M12 3v18M5 7h4M15 7h4M5 12h4M15 12h4M5 17h4M15 17h4",
  search: "M5 11a6 6 0 1 0 12 0 6 6 0 1 0-12 0M16 16l5 5",
  card: "M3 6h18v12H3zM7 10h4M7 14h8",
  mic: "M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M9 21h6",
  stop: "M7 7h10v10H7z",
  speaker: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  share: "M12 3v12M8 7l4-4 4 4M5 13v7h14v-7",
  install: "M12 3v12M8 11l4 4 4-4M5 20h14",
  back: "M15 5l-7 7 7 7",
  menu: "M4 7h16M4 12h16M4 17h16",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  activity: "M8 3 4 7l4 4M4 7h16m-4 14 4-4-4-4M20 17H4",
  receipt: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM14 8H8M16 12H8M13 16H8",
  shield:
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  settings: "M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4",
  bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 21h4",
  chev: "M9 5l7 7-7 7",
  chev_down: "M5 9l7 7 7-7",
  sun: "M8 12a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  pin: "M12 21s6-6 6-11a6 6 0 1 0-12 0c0 5 6 11 6 11zM10 10a2 2 0 1 0 4 0 2 2 0 1 0-4 0",
  tick: "m5 12 4 4 10-10",
  /** A handset, for a call; `phone` is the device. */
  call: "M5 4h4l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM9 13a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  globe: "M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  people:
    "M6 8a3 3 0 1 0 6 0 3 3 0 1 0-6 0M14.5 9a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M3 20c0-3 3-5 6-5s6 2 6 5M15 15c3 0 5 2 5 4",
  pencil: "M4 20l4-1 11-11-3-3L5 16z",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  star: "m12 3 2.7 5.6 6.3.9-4.5 4.4 1 6.1-5.5-2.9L6.5 20l1-6.1L3 9.5l6.3-.9z",
  copy: "M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3",
  download: "M12 4v12M6 10l6 6 6-6M5 20h14",
  flag: "M5 21V4h10l-1 3 1 3H5",
  eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  clock: "M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M12 7v5l3 2",
  map: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14",
  move: "M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4",
  /** A speech bubble with a handset: a chat that also calls, as WhatsApp is read. */
  whatsapp:
    "M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3zM8.5 9.5a1 1 0 0 1 1-1h1l1 2-1 1a5 5 0 0 0 2.5 2.5l1-1 2 1v1a1 1 0 0 1-1 1 7 7 0 0 1-6.5-6.5z",
  help: "M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17v.5",
  broom: "M14 3l-5 9M9 12l-4 3 3 6 5-3z",
  pot: "M4 10h16l-2 9H6zM9 10V7M15 10V7M2 10h20",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.5-7 10-7 10z",
  car: "M4 15l2-6h12l2 6v4H4zM6.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0M14.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 1 0-3 0",
  needle: "M4 20L18 6M14 4l6 6M16 8l2-2",
  brush: "M4 4h10v6H4zM9 10v10M14 6h5v4h-5",
  wrench: "M14 4a4 4 0 0 0-5 5L4 14l3 3 5-5a4 4 0 0 0 5-5l-3 3-2-2z",
  /** A cog, for settings drawn as one; `settings` is the sliders. */
  gear: "M9.9 5.1 10.4 2.6h3.2l.5 2.5 1.3.6 2.1-1.5 2.3 2.3-1.5 2.1.6 1.3 2.5.5v3.2l-2.5.5-.6 1.3 1.5 2.1-2.3 2.3-2.1-1.5-1.3.6-.5 2.5h-3.2l-.5-2.5-1.3-.6-2.1 1.5-2.3-2.3 1.5-2.1-.6-1.3-2.5-.5v-3.2l2.5-.5.6-1.3-1.5-2.1 2.3-2.3 2.1 1.5zM9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  /** A rupee note: the bill, its middle and the two corner dots. */
  money:
    "M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM9.5 12a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M6 12h.01M18 12h.01",
} as const;

export type IconName = keyof typeof PATHS;

/**
 * One line icon, `size` px square (default 18). The width and height are the SVG's own attributes, which any CSS rule
 * outranks, so a screen's stylesheet can still size its icons; `.ic` itself sets no size.
 */
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
