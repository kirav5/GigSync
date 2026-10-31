import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { useWideScreen } from "../adapters/wide.js";
import { useI18n } from "../i18n.js";
import { useLinks } from "../screens/mentor/links.js";
import type { Screen } from "../state.js";
import { DockProvider } from "../ui/Dock.js";
import { setDrawer, useDrawer } from "./drawer.js";
import { COUNTED_ROW, isHome, isSub, titleOf } from "./nav.js";
import { Sidebar, type SidebarProps } from "./Sidebar.js";
import { TopBar } from "./TopBar.js";
import "./shell.css";

const ESCAPE = "Escape";
/** The first row of the menu, where focus goes when it opens. */
const FIRST_ROW = ".sidebar .nav button";

type Props = Omit<SidebarProps, "unread" | "drawer" | "onClose"> & {
  /** The open chat's title, shown in the top bar while the chat is on screen. */
  chatTitle: string;
  /** The chat this owner comes home to. */
  home: Screen;
  /** The on-screen Back, which goes where Android's would. */
  onBack: () => void;
  children: ReactNode;
};

/** Escape closes the open drawer, and focus goes back to the menu button that opened it. */
function useDrawerKeys(drawer: boolean, menu: RefObject<HTMLButtonElement | null>) {
  const was = useRef(drawer);
  useEffect(() => {
    if (drawer && !was.current) document.querySelector<HTMLElement>(FIRST_ROW)?.focus({ preventScroll: true });
    if (!drawer && was.current) menu.current?.focus({ preventScroll: true });
    was.current = drawer;
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ESCAPE) setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer, menu]);
}

/**
 * The signed-in layout, as the collab app's: the menu (a drawer on a phone, a column on a wide screen) and the main
 * area, top to bottom: the title row, the screen, which alone scrolls, and the dock with the screen's one primary
 * action. The chat is home; every other screen is a row of the menu, or opened from one.
 */
export function Shell({ chatTitle, home, onBack, children, ...side }: Props) {
  const { t } = useI18n();
  const { unread } = useLinks();
  const wide = useWideScreen();
  const open = useDrawer();
  const drawer = open && !wide;
  const menu = useRef<HTMLButtonElement>(null);
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  useDrawerKeys(drawer, menu);
  // Going wide leaves no drawer to come back to.
  useEffect(() => {
    if (wide) setDrawer(false);
  }, [wide]);

  const { screen, onScreen } = side;
  const titleKey = titleOf(screen);
  const go = (s: Screen) => {
    setDrawer(false);
    onScreen(s);
  };
  return (
    <div className={drawer ? "app shell nav-open" : "app shell"}>
      <Sidebar
        {...side}
        onScreen={go}
        onNewChat={() => {
          setDrawer(false);
          side.onNewChat();
        }}
        unread={unread}
        drawer={!wide}
        onClose={() => setDrawer(false)}
      />
      {drawer && <div className="shade" aria-hidden="true" onClick={() => setDrawer(false)} />}
      <div className="main" inert={drawer}>
        <TopBar
          title={isHome(screen) || !titleKey ? chatTitle : t(titleKey)}
          sub={isSub(screen)}
          home={screen === home}
          open={drawer}
          tasks={side.tasks}
          unread={unread > 0}
          onActivity={screen === COUNTED_ROW}
          menuRef={menu}
          onMenu={() => setDrawer(!open)}
          onBack={onBack}
          onChat={() => go(home)}
          onNeeds={() => go(COUNTED_ROW)}
        />
        {/* Keyed by screen so each one opens scrolled to its top, not where the last one was left. */}
        <main className="content" key={screen}>
          <div className="inner">
            <DockProvider slot={dock}>{children}</DockProvider>
          </div>
        </main>
        <div className="dock" ref={setDock} />
      </div>
    </div>
  );
}
