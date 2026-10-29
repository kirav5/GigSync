import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";

/** The element the Shell or Frame renders between the scrolling content and the tab bar; null until it mounts. */
const DockSlot = createContext<HTMLElement | null>(null);

/** Gives the screens inside it a dock: `slot` is the element they portal their primary action into. */
export function DockProvider({ slot, children }: { slot: HTMLElement | null; children: ReactNode }) {
  return <DockSlot.Provider value={slot}>{children}</DockSlot.Provider>;
}

/**
 * A screen's one primary action, with its status line above it, pinned below the content and above the tab bar so it
 * stays in reach on a short screen and rides on the keyboard. It never covers a field: the content scrolls above it.
 */
export function Dock({ children }: { children: ReactNode }) {
  const slot = useContext(DockSlot);
  return slot ? createPortal(children, slot) : null;
}
