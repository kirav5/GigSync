import type { ReactNode } from "react";
import { Screen } from "./state.js";
import { C } from "./ui/cls.js";
import { Icon, type IconName } from "./ui/Icon.js";
import { Logo } from "./ui/Logo.js";

export interface NavItem {
  screen: Screen;
  label: string;
  icon: IconName;
}

const SETTINGS: NavItem = { screen: Screen.settings, label: "Settings", icon: "user" };
const AGENT: NavItem = { screen: Screen.agent, label: "Ask my agent", icon: "chat" };

/** A worker's menu: jobs that found them and their card first, then the record they keep. */
export const WORKER_NAV: readonly NavItem[] = [
  { screen: Screen.requests, label: "Requests", icon: "jobs" },
  { screen: Screen.card, label: "My card", icon: "card" },
  { screen: Screen.today, label: "Today", icon: "home" },
  { screen: Screen.jobs, label: "Jobs in person", icon: "plus" },
  { screen: Screen.pay, label: "Get paid", icon: "qr" },
  { screen: Screen.record, label: "My record", icon: "book" },
  AGENT,
  SETTINGS,
];

/** A consumer's menu: find someone, then follow what was asked. */
export const CONSUMER_NAV: readonly NavItem[] = [
  { screen: Screen.find, label: "Find", icon: "search" },
  { screen: Screen.requests, label: "My jobs", icon: "jobs" },
  AGENT,
  SETTINGS,
];

interface Props {
  nav: readonly NavItem[];
  /** Who is signed in, shown in the menu footer. */
  who: string;
  onSignOut: () => void;
  screen: Screen;
  onScreen: (s: Screen) => void;
  navOpen: boolean;
  onNav: (open: boolean) => void;
  trail: Partial<Record<Screen, string>>;
  status: string;
  children: ReactNode;
}

/** Collab's layout: a menu on the left, the screen beside it; on a phone the menu slides in from the left. */
export function Shell({ nav, who, onSignOut, screen, onScreen, navOpen, onNav, trail, status, children }: Props) {
  const title = nav.find((n) => n.screen === screen)?.label ?? "";
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
            {nav.map((n) => (
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
          <span className={C.faint}>
            {who} · {status}
          </span>
          <button type={C.button} className={C.quiet} onClick={onSignOut}>
            Sign out
          </button>
        </footer>
      </aside>
      {navOpen && <button type={C.button} className="shade" aria-label="Close menu" onClick={() => onNav(false)} />}
      <main className="main">
        <div className="topbar">
          <button type={C.button} className={`${C.quiet} menu`} aria-label="Open menu" onClick={() => onNav(true)}>
            <Icon name="menu" />
          </button>
          <span className={C.label}>{title}</span>
        </div>
        <div className="content">
          <div className="inner">{children}</div>
        </div>
      </main>
    </div>
  );
}
