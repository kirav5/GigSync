import type { ReactNode } from "react";

/** A screen's one primary action, for the dock above the tab bar. Renders in place until the shell has a dock slot. */
export function Dock({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
