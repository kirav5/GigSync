import { type ReactNode, useState } from "react";
import { Art, artSrc } from "../screens/start/StartArt.js";
import { DockProvider } from "./Dock.js";

/** The mural's figures for the wide screen's side panel, the first spanning both columns. */
const SIDE_TILES: readonly Art[] = [Art.welcome, Art.work, Art.help, Art.cook, Art.move];

/**
 * The screens before sign-in (Language, Sign-in): one column with the Shell's dock slot, and no top bar or tabs. On a
 * wide screen the column sits centred on the right and a panel of the mural's figures fills the left, so a computer
 * gets a page laid out for it rather than a phone stretched wide. The panel is decoration only, and its pictures load
 * only where it shows.
 */
export function Frame({ children }: { children: ReactNode }) {
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  return (
    <div className="app start-frame">
      <aside className="start-side" aria-hidden="true">
        {SIDE_TILES.map((art) => (
          <span key={art} className="start-side-tile" data-art={art}>
            <img src={artSrc(art)} alt="" loading="lazy" decoding="async" />
          </span>
        ))}
      </aside>
      <div className="main">
        <main className="content">
          <div className="inner">
            <DockProvider slot={dock}>{children}</DockProvider>
          </div>
        </main>
        <div className="dock" ref={setDock} />
      </div>
    </div>
  );
}
