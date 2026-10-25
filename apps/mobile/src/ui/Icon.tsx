/** Line icons from Collab's sprite (web/home.html), drawn in the text colour. */
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
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  phone: "M6.5 2.5h11v19h-11zM11 18h2",
  wall: "M12 3v18M5 7h4M15 7h4M5 12h4M15 12h4M5 17h4M15 17h4",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
