import { type Chat, ChatDay, groupChats, MAX_CHATS, type MessageKey } from "@gigsync/core";
import { useState } from "react";
import { stopSpeaking } from "../adapters/speech.js";
import { useI18n } from "../i18n.js";
import { openChat, removeChat, useTalk } from "../talk/talkStore.js";
import type { Turn } from "../talk/turns.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";

/** The heading over each day of the list. */
const DAY_LABEL: Readonly<Record<ChatDay, MessageKey>> = {
  [ChatDay.today]: "chats.today",
  [ChatDay.yesterday]: "chats.yesterday",
  [ChatDay.earlier]: "chats.earlier",
};

/** Going to another chat: a question being read aloud in this one stops. */
export function going(to: () => void) {
  void stopSpeaking();
  to();
}

/** The trash button on one chat, and its one confirm; it says so when the chat holds the unfinished card. */
function DeleteChat({ title, id, card }: { title: string; id: string; card: boolean }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const label = t("chats.delete_label", { title });
  return (
    <>
      <button type={C.button} className="session-del" aria-label={label} title={label} onClick={() => setAsking(true)}>
        <Icon name="trash" size={16} />
      </button>
      {asking && (
        <div className={`${C.cardWait} chat-confirm`} role="dialog" aria-label={label}>
          <p>{t(card ? "chats.delete_confirm_card" : "chats.delete_confirm")}</p>
          <div className={C.actions}>
            <button type={C.button} className={C.danger} onClick={() => going(() => removeChat(id))}>
              {t("chats.delete_yes")}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => setAsking(false)}>
              {t("chats.keep")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** One chat in the menu: its title opens it (the open one is marked), the one holding the unfinished card says so. */
function ChatRow({ chat, shown, onOpened }: { chat: Chat<Turn>; shown: boolean; onOpened: () => void }) {
  const { t } = useI18n();
  const { open, interviewIn } = useTalk();
  const title = chat.title ?? t("chats.untitled");
  const card = interviewIn === chat.id;
  const on = shown && chat.id === open;
  return (
    <li className="session-row">
      <button
        type={C.button}
        className={on ? "session on" : "session"}
        aria-current={on ? true : undefined}
        title={title}
        onClick={() =>
          going(() => {
            openChat(chat.id);
            onOpened();
          })
        }
      >
        <span className="session-title">{title}</span>
        {card && <span className={C.faint}>{t("chats.card_waiting")}</span>}
      </button>
      <DeleteChat title={title} id={chat.id} card={card} />
    </li>
  );
}

/**
 * A worker's chats on this phone, in the menu as the collab app lists its sessions: newest first under Today,
 * Yesterday and Earlier. `shown`: Talk is on screen, so the open chat is marked. Each can be deleted after a confirm.
 */
export function DrawerChats({ shown, onOpened }: { shown: boolean; onOpened: () => void }) {
  const { t } = useI18n();
  const { chats } = useTalk();
  const now = new Date();
  const groups = groupChats(chats, now, -now.getTimezoneOffset());
  return (
    <section className="side-chats" aria-label={t("chats.title")}>
      {groups.length === 0 && <p className={C.faint}>{t("chats.empty")}</p>}
      {groups.map(({ day, chats: inDay }) => (
        <div key={day} className="side-group">
          <span className={C.label}>{t(DAY_LABEL[day])}</span>
          <ul className="sessions">
            {inDay.map((chat) => (
              <ChatRow key={chat.id} chat={chat} shown={shown} onOpened={onOpened} />
            ))}
          </ul>
        </div>
      ))}
      {groups.length > 0 && <p className={C.faint}>{t("chats.kept", { count: MAX_CHATS })}</p>}
    </section>
  );
}
