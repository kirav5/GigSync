import { useEffect, useRef } from "react";
import { closeOnBack } from "../adapters/back.js";
import { useI18n } from "../i18n.js";
import { Screen } from "../state.js";
import { Avatar, AvatarSize, AvatarTone } from "../ui/Avatar.js";
import { Brand } from "../ui/Brand.js";
import { C } from "../ui/cls.js";
import { Icon, type IconName } from "../ui/Icon.js";
import { useChatList } from "./chatLists.js";
import { DrawerChats } from "./DrawerChats.js";
import { useDrawerSwipe } from "./useDrawerSwipe.js";
import "./drawer.css";

/** The key that closes the drawer, as it closes a sheet. */
const ESCAPE = "Escape";

/** A place the drawer opens besides the chats: its line icon, its name and its screen. */
interface Place {
  icon: IconName;
  label: "nav.card" | "me.addresses" | "me.help";
  screen: Screen;
}

/** A worker's card, or a household's saved places, then Help: the few places not already a tab or the bell. */
const WORKER_PLACES: readonly Place[] = [
  { icon: "card", label: "nav.card", screen: Screen.card },
  { icon: "help", label: "me.help", screen: Screen.help },
];
const HOUSEHOLD_PLACES: readonly Place[] = [
  { icon: "pin", label: "me.addresses", screen: Screen.addresses },
  { icon: "help", label: "me.help", screen: Screen.help },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isWorker: boolean;
  /** The owner's name, at the foot beside their initial. */
  name: string;
  /** The chat being looked at is on screen, so the list marks it. */
  chatShown: boolean;
  /** A chat was opened from the list: its screen comes forward. */
  onOpened: () => void;
  onNewChat: () => void;
  /** Opens one of the drawer's places, or Settings from the gear. */
  onGo: (screen: Screen) => void;
  /** The owner's name at the foot opens their profile sheet. */
  onProfile: () => void;
}

/** One row of the drawer: a line icon and its words, the whole row a tap. `lead` marks New chat, on its soft fill. */
function DrawerRow({
  icon,
  label,
  lead,
  onPick,
}: {
  icon: IconName;
  label: string;
  lead?: boolean;
  onPick: () => void;
}) {
  return (
    <button type={C.button} className={lead ? "drawer-row lead" : "drawer-row"} onClick={onPick}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
    </button>
  );
}

/**
 * The drawer from the left edge, laid out as a phone's own assistant keeps its menu: the brand and a close button at
 * the top, New chat as the first row on a soft fill, the owner's few places, the recent chats kept on this phone (ADR
 * 0035), and the owner at the foot with the gear to Settings. The menu button opens it, and so does a thumb pulling
 * in from the left edge, the drawer following the thumb; a push back to the left, a tap on the shade, the close
 * button or Escape closes it. On a wide screen the chats are a screen of their own instead (Shell).
 */
export function ChatDrawer(props: Props) {
  const { open, onOpenChange, isWorker, name, chatShown, onOpened, onNewChat, onGo, onProfile } = props;
  const { t } = useI18n();
  const list = useChatList(isWorker);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  useDrawerSwipe(root, panel, open, onOpenChange);

  // Back (the phone's, or the browser's) closes the open drawer before it moves anywhere.
  useEffect(() => (open ? closeOnBack(() => onOpenChange(false)) : undefined), [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ESCAPE) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    panel.current?.focus({ preventScroll: true });
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  /** Closes the drawer first, so what opens has nothing over it. */
  const then = (move: () => void) => () => {
    onOpenChange(false);
    move();
  };
  const places = isWorker ? WORKER_PLACES : HOUSEHOLD_PLACES;
  return (
    <div ref={root} className="drawer" data-open={open || undefined} inert={!open}>
      <div className="drawer-shade" aria-hidden onClick={() => onOpenChange(false)} />
      <nav ref={panel} className="drawer-panel" aria-label={t("chats.title")} tabIndex={-1}>
        <div className="drawer-head">
          <Brand />
          <button
            type={C.button}
            className="round-btn"
            aria-label={t("chats.close")}
            onClick={() => onOpenChange(false)}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="drawer-list">
          <DrawerRow icon="pencil" label={t("chats.new")} lead onPick={then(onNewChat)} />
          {places.map((p) => (
            <DrawerRow key={p.label} icon={p.icon} label={t(p.label)} onPick={then(() => onGo(p.screen))} />
          ))}
          <h2 className="drawer-section">{t("chats.recent")}</h2>
          <DrawerChats list={list} shown={chatShown} onOpened={then(onOpened)} />
        </div>
        <div className="drawer-foot">
          <button type={C.button} className="drawer-me" aria-label={t("profile.open")} onClick={then(onProfile)}>
            <Avatar name={name} size={AvatarSize.md} tone={AvatarTone.rust} />
            <span className="drawer-name">{name}</span>
          </button>
          <button
            type={C.button}
            className="round-btn drawer-gear"
            aria-label={t("nav.settings")}
            onClick={then(() => onGo(Screen.settings))}
          >
            <Icon name="gear" size={20} />
          </button>
        </div>
      </nav>
    </div>
  );
}
