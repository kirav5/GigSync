import type { ReactNode } from "react";
import { useI18n } from "../i18n.js";
import { useBar } from "../ui/Bar.js";
import { Brand } from "../ui/Brand.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import "./topbar.css";

interface Props {
  /** The shell's title for the open screen, or none on Home, where the brand stands; a screen's own (`BarTitle`) wins. */
  title: string | undefined;
  /** There is somewhere to go back to: the open screen was opened from inside another (never on a tab). */
  canBack: boolean;
  onBack: () => void;
  /** Opens the chats kept on this phone. */
  onChats: () => void;
  /** A chat opened from inside another screen (Talk from Home): Back takes the left, so the chats go to the end. */
  chatsAtEnd: boolean;
  /** The round profile button, last at the end. */
  profile: ReactNode;
}

/** The round chats button: every chat kept on this phone, and New chat. */
function ChatsButton({ onOpen, icon }: { onOpen: () => void; icon: "menu" | "chat" }) {
  const { t } = useI18n();
  return (
    <button
      type={C.button}
      className="round-btn"
      aria-label={t("chats.title")}
      title={t("chats.title")}
      onClick={onOpen}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

/**
 * The title row, one cream band with the phone's status bar above it, as the design's Home: on the left a round
 * button to the chats (Back instead, while there is somewhere to go back to), beside it the sun and "gigsync" on
 * Home and the screen's title elsewhere, and on the right the screen's own icon buttons (ui/Bar.tsx `BarEnd`) and the
 * round profile button with the owner's initial. The page's one banner.
 */
export function TopBar({ title, canBack, onBack, onChats, chatsAtEnd, profile }: Props) {
  const { t } = useI18n();
  const bar = useBar();
  const shown = bar.title ?? title;
  return (
    <header className="topbar">
      {canBack ? (
        <button type={C.button} className="back round-btn" aria-label={t("a11y.back")} onClick={onBack}>
          <Icon name="back" size={22} />
        </button>
      ) : (
        <ChatsButton icon="menu" onOpen={onChats} />
      )}
      <span className="topbar-title">{shown ?? <Brand />}</span>
      <span className="bar-end" ref={bar.setSlot} />
      {canBack && chatsAtEnd && <ChatsButton icon="chat" onOpen={onChats} />}
      {profile}
    </header>
  );
}
