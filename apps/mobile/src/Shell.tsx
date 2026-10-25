import type { ReactNode } from "react";
import { Screen } from "./state.js";
import { C } from "./ui/cls.js";
import { Icon, type IconName } from "./ui/Icon.js";
import { Logo } from "./ui/Logo.js";

const NAV: readonly { screen: Screen; label: string; icon: IconName }[] = [
  { screen: Screen.today, label: "Today", icon: "home" },
  { screen: Screen.jobs, label: "Jobs", icon: "jobs" },
  { screen: Screen.pay, label: "Get paid", icon: "qr" },
  { screen: Screen.record, label: "My record", icon: "book" },
  { screen: Screen.agent, label: "Ask my agent", icon: "chat" },
  { screen: Screen.settings, label: "Settings", icon: "user" },
];

export const screenTitle = (s: Screen) => NAV.find((n) => n.screen === s)?.label ?? "";

interface Props {
  screen: Screen;
  onScreen: (s: Screen) => void;
  navOpen: boolean;
  onNav: (open: boolean) => void;
  trail: Partial<Record<Screen, string>>;
  status: string;
  children: ReactNode;
}

/** Collab's layout: a menu on the left, the screen beside it; on a phone the menu slides in from the left. */
export function Shell({ screen, onScreen, navOpen, onNav, trail, status, children }: Props) {
  return (
    <div className={navOpen ? "app nav-open" : "app"}>
      <aside className="sidebar" aria-label="Menu">
        <header>
          <span className="brand">
            <Logo size={20} />
            GigSync
          </span>
        </header>
        <div className="scroll">
          <nav className="nav">
            {NAV.map((n) => (
              <button
                key={n.screen}
                type={C.button}
                aria-current={n.screen === screen ? "page" : undefined}
                onClick={() => {
                  onScreen(n.screen);
                  onNav(false);
                }}
              >
                <Icon name={n.icon} />
                {n.label}
                {trail[n.screen] && <span className="trail">{trail[n.screen]}</span>}
              </button>
            ))}
          </nav>
        </div>
        <footer>
          <span className={C.label}>Your record stays on this phone</span>
          <span className={C.faint}>{status}</span>
        </footer>
      </aside>
      {navOpen && <button type={C.button} className="shade" aria-label="Close menu" onClick={() => onNav(false)} />}
      <main className="main">
        <div className="topbar">
          <button type={C.button} className={`${C.quiet} menu`} aria-label="Open menu" onClick={() => onNav(true)}>
            <Icon name="menu" />
          </button>
          <span className={C.label}>{screenTitle(screen)}</span>
        </div>
        <div className="content">
          <div className="inner">{children}</div>
        </div>
      </main>
    </div>
  );
}
