import type { MessageKey } from "@gigsync/core";
import type { ReactNode } from "react";
import { useI18n } from "./i18n.js";
import { Screen } from "./state.js";
import { C } from "./ui/cls.js";
import { Icon, type IconName } from "./ui/Icon.js";
import { Logo } from "./ui/Logo.js";

export interface NavItem {
  screen: Screen;
  label: MessageKey;
  icon: IconName;
}

const SETTINGS: NavItem = { screen: Screen.profile, label: "nav.settings", icon: "user" };
const AGENT: NavItem = { screen: Screen.talk, label: "nav.agent", icon: "chat" };

/** A worker's menu: jobs that found them and their card first, then the record they keep. */
export const WORKER_NAV: readonly NavItem[] = [
  { screen: Screen.requests, label: "nav.requests", icon: "jobs" },
  { screen: Screen.card, label: "nav.card", icon: "card" },
  { screen: Screen.today, label: "nav.today", icon: "home" },
  { screen: Screen.jobs, label: "nav.jobs", icon: "plus" },
  { screen: Screen.pay, label: "nav.pay", icon: "qr" },
  { screen: Screen.record, label: "nav.record", icon: "book" },
  AGENT,
  SETTINGS,
];

/** A consumer's menu: find someone, then follow what was asked. */
export const CONSUMER_NAV: readonly NavItem[] = [
  { screen: Screen.find, label: "nav.find", icon: "search" },
  { screen: Screen.requests, label: "nav.my_jobs", icon: "jobs" },
  AGENT,
  SETTINGS,
];

/** What the menu counts beside its items. */
export interface NavCounts {
  /** Decisions waiting for the owner. */
  waiting: number;
  jobs: number;
  inPerson: number;
  /** Jobs done and not yet paid. */
  due: number;
}

interface Props {
  nav: readonly NavItem[];
  /** Who is signed in, shown in the menu footer. */
  name: string;
  isWorker: boolean;
  onSignOut: () => void;
  screen: Screen;
  onScreen: (s: Screen) => void;
  navOpen: boolean;
  onNav: (open: boolean) => void;
  counts: NavCounts;
  platform: string;
  online: boolean | undefined;
  children: ReactNode;
}

/** Collab's layout: a menu on the left, the screen beside it; on a phone the menu slides in from the left. */
export function Shell(props: Props) {
  const { nav, name, isWorker, onSignOut, screen, onScreen, navOpen, onNav, counts, platform, online, children } =
    props;
  const { t } = useI18n();
  const item = nav.find((n) => n.screen === screen);
  const title = item ? t(item.label) : "";
  const trail: Partial<Record<Screen, string>> = {
    [Screen.requests]: counts.waiting
      ? t("trail.to_decide", { count: counts.waiting })
      : counts.jobs
        ? String(counts.jobs)
        : "",
    [Screen.jobs]: counts.inPerson ? String(counts.inPerson) : "",
    [Screen.pay]: counts.due ? t("trail.due", { count: counts.due }) : "",
  };
  const net = online === undefined ? "…" : t(online ? "net.online" : "net.offline");
  return (
    <div className={navOpen ? "app nav-open" : "app"}>
      <aside className="sidebar" aria-label={t("a11y.menu")}>
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
                {t(n.label)}
                {trail[n.screen] && <span className="trail">{trail[n.screen]}</span>}
              </button>
            ))}
          </nav>
        </div>
        <footer>
          <span className={C.label}>{t("shell.record_here")}</span>
          <span className={C.faint}>
            {name} · {t(isWorker ? "role.worker" : "role.customer")} · {platform} · {net}
          </span>
          <button type={C.button} className={C.quiet} onClick={onSignOut}>
            {t("shell.sign_out")}
          </button>
        </footer>
      </aside>
      {navOpen && (
        <button type={C.button} className="shade" aria-label={t("a11y.close_menu")} onClick={() => onNav(false)} />
      )}
      <main className="main">
        <div className="topbar">
          <button
            type={C.button}
            className={`${C.quiet} menu`}
            aria-label={t("a11y.open_menu")}
            onClick={() => onNav(true)}
          >
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
