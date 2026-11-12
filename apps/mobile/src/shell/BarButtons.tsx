import type { MessageKey } from "@gigsync/core";
import { useI18n } from "../i18n.js";
import { BarEnd } from "../ui/Bar.js";
import { C } from "../ui/cls.js";
import { Icon, type IconName } from "../ui/Icon.js";

/** One icon button at the top bar's end, named by its words alone. */
function BarButton({ icon, label, onOpen }: { icon: IconName; label: MessageKey; onOpen: () => void }) {
  const { t } = useI18n();
  return (
    <button type={C.button} className="bar-icon" aria-label={t(label)} title={t(label)} onClick={onOpen}>
      <Icon name={icon} size={22} />
    </button>
  );
}

/** The bell on Home, Jobs and Find: what needs the owner now. */
export function BellButton({ onOpen }: { onOpen: () => void }) {
  return (
    <BarEnd>
      <BarButton icon="bell" label="tabs.alerts" onOpen={onOpen} />
    </BarEnd>
  );
}

/** The chats on Talk and Find: every chat kept on this phone, and New chat. */
export function ChatsButton({ onOpen }: { onOpen: () => void }) {
  return (
    <BarEnd>
      <BarButton icon="chat" label="chats.title" onOpen={onOpen} />
    </BarEnd>
  );
}
