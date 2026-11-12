import { type ReactNode, useState } from "react";
import { DockProvider } from "./Dock.js";

/** The screens before sign-in (Language, Sign-in): one column with the Shell's dock slot, and no top bar or tabs. */
export function Frame({ children }: { children: ReactNode }) {
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  return (
    <div className="app">
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
