import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Dock } from "../ui/Dock.js";
import { Icon } from "../ui/Icon.js";
import { useChatList } from "./chatLists.js";
import { DrawerChats } from "./DrawerChats.js";

interface Props {
  isWorker: boolean;
  /** A chat was opened from the list: its screen comes back. */
  onOpened: () => void;
  onNewChat: () => void;
}

/**
 * The chats kept on this phone (ADR 0035), from the top bar on Talk and Find: a worker's Talk chats or a household's
 * Find chats by day, the open one marked, each deletable after a confirm; New chat is the screen's one action.
 */
export function ChatsScreen({ isWorker, onOpened, onNewChat }: Props) {
  const { t } = useI18n();
  const list = useChatList(isWorker);
  return (
    <>
      <DrawerChats list={list} shown onOpened={onOpened} />
      <Dock>
        <button type={C.button} className={C.wide} onClick={onNewChat}>
          <Icon name="plus" size={18} />
          {t("chats.new")}
        </button>
      </Dock>
    </>
  );
}
