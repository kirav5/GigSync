import { useEffect, useRef } from "react";
import { closeOnBack } from "../adapters/back.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import { useChatList } from "./chatLists.js";
import { DrawerChats } from "./DrawerChats.js";
import { useDrawerSwipe } from "./useDrawerSwipe.js";
import "./drawer.css";

/** The key that closes the drawer, as it closes a sheet. */
const ESCAPE = "Escape";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isWorker: boolean;
  /** The chat being looked at is on screen, so the list marks it. */
  chatShown: boolean;
  /** A chat was opened from the list: its screen comes forward. */
  onOpened: () => void;
  onNewChat: () => void;
}

/**
 * The chats kept on this phone (ADR 0035) as a drawer from the left edge, the way a phone's own apps keep them: the
 * menu button opens it, and so does a thumb pulling in from the left edge, the drawer following the thumb; a push back
 * to the left, a tap on the shade or Escape closes it. New chat is its one action at the foot. On a wide screen the
 * chats are a screen of their own instead (Shell).
 */
export function ChatDrawer({ open, onOpenChange, isWorker, chatShown, onOpened, onNewChat }: Props) {
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

  return (
    <div ref={root} className="drawer" data-open={open || undefined} inert={!open}>
      <div className="drawer-shade" aria-hidden onClick={() => onOpenChange(false)} />
      <nav ref={panel} className="drawer-panel" aria-label={t("chats.title")} tabIndex={-1}>
        <h2 className="drawer-title">{t("chats.title")}</h2>
        <div className="drawer-list">
          <DrawerChats
            list={list}
            shown={chatShown}
            onOpened={() => {
              onOpenChange(false);
              onOpened();
            }}
          />
        </div>
        <div className="drawer-foot">
          <button
            type={C.button}
            className={C.wide}
            onClick={() => {
              onOpenChange(false);
              onNewChat();
            }}
          >
            <Icon name="plus" size={18} />
            {t("chats.new")}
          </button>
        </div>
      </nav>
    </div>
  );
}
