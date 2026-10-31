/** Line icons from Collab's sprite (web/home.html, web/js/ui.js), drawn in the text colour. */
const PATHS = {
  home: "m3 11 9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5",
  jobs: "M3 7h18v13H3zM9 7V4h6v3M3 12h18",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 19h1.5M19 14v1.5",
  book: "M4 19V5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2zM8 7h8",
  chat: "M4 5h16v11H9l-5 4z",
  user: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7",
  lock: "M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3",
  check: "M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM8 12l3 3 5-6",
  rupee: "M6 4h12M6 9h12M6 4h3a5 5 0 0 1 0 10H6l8 7",
  plus: "M12 5v14M5 12h14",
  close: "M6 6l12 12M18 6 6 18",
  phone: "M6.5 2.5h11v19h-11zM11 18h2",
  wall: "M12 3v18M5 7h4M15 7h4M5 12h4M15 12h4M5 17h4M15 17h4",
  search: "M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 20 20",
  card: "M3 6h18v12H3zM7 10h4M7 14h8",
  mic: "M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3",
  stop: "M7 7h10v10H7z",
  speaker: "M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  share: "M12 3v12M8 7l4-4 4 4M5 12v8h14v-8",
  install: "M12 3v12M8 11l4 4 4-4M5 20h14",
  back: "M15 5l-7 7 7 7",
  menu: "M4 6h16M4 12h16M4 18h16",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
  activity: "M8 3 4 7l4 4M4 7h16m-4 14 4-4-4-4M20 17H4",
  receipt: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1zM14 8H8M16 12H8M13 16H8",
  shield:
    "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
  settings: "M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
