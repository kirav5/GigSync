import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/** What a screen can put in the top bar: icons at its end, and a title of its own. */
interface BarState {
  /** The element at the top bar's end; null until it mounts, and outside a signed-in frame. */
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
  /** A screen's own title, while it is open; undefined for the shell's. */
  title: string | undefined;
  setTitle: (title: string | undefined) => void;
}

const NONE: BarState = { slot: null, setSlot: () => undefined, title: undefined, setTitle: () => undefined };
const Bar = createContext<BarState>(NONE);

/** Gives the top bar and the screens under it one place to meet: the bar's end slot and a title override. */
export function BarProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState<string>();
  const value = useMemo(() => ({ slot, setSlot, title, setTitle }), [slot, title]);
  return <Bar.Provider value={value}>{children}</Bar.Provider>;
}

/** The top bar's side of it: where its end slot is, and the title a screen set. */
export const useBar = (): BarState => useContext(Bar);

/**
 * A screen's icon buttons at the top bar's end (a bell, the chats), portalled there as the dock takes a screen's
 * primary action (ui/Dock.tsx). Nothing outside a signed-in frame, which has no top bar.
 */
export function BarEnd({ children }: { children: ReactNode }) {
  const { slot } = useContext(Bar);
  return slot ? createPortal(children, slot) : null;
}

/** Sets the top bar's title while the screen that renders it is open (one per screen), as a job's own name. */
export function BarTitle({ text }: { text: string }) {
  const { setTitle } = useContext(Bar);
  useEffect(() => {
    setTitle(text);
    return () => setTitle(undefined);
  }, [text, setTitle]);
  return null;
}
