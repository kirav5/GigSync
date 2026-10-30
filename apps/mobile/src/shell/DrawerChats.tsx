import { type Chat, ChatDay, groupChats, MAX_CHATS, type MessageKey } from "@gigsync/core";
import { useState } from "react";
import { stopSpeaking } from "../adapters/speech.js";
import { useI18n } from "../i18n.js";
import { C } from "../ui/cls.js";
import { Icon } from "../ui/Icon.js";
import type { ChatList } from "./chatLists.js";

/** The heading over each day of the list. */
const DAY_LABEL: Readonly<Record<ChatDay, MessageKey>> = {
  [ChatDay.today]: "chats.today",
  [ChatDay.yesterday]: "chats.yesterday",
  [ChatDay.earlier]: "chats.earlier",
};

/** Going to another chat: a question being read aloud in this one stops. */
function going(to: () => void) {
  void stopSpeaking();
  to();
}

/** The trash button on one chat, and its one confirm, which says what goes with the chat and what stays. */
function DeleteChat({ title, confirm, onDelete }: { title: string; confirm: MessageKey; onDelete: () => void }) {
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
          <p>{t(confirm)}</p>
          <div className={C.actions}>
            <button type={C.button} className={C.danger} onClick={() => going(onDelete)}>
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

interface RowProps {
  chat: Chat<unknown>;
  list: ChatList;
  shown: boolean;
  onOpened: () => void;
}

/** One chat in the menu: its title opens it (the open one is marked), with a note when one is due. */
function ChatRow({ chat, list, shown, onOpened }: RowProps) {
  const { t } = useI18n();
  const title = chat.title ?? t("chats.untitled");
  const note = list.noteOf(chat.id);
  const on = shown && chat.id === list.open;
  return (
    <li className="session-row">
      <button
        type={C.button}
        className={on ? "session on" : "session"}
        aria-current={on ? true : undefined}
        title={title}
        onClick={() =>
          going(() => {
            list.openChat(chat.id);
            onOpened();
          })
        }
      >
        <span className="session-title">{title}</span>
        {note && <span className={C.faint}>{t(note)}</span>}
      </button>
      <DeleteChat title={title} confirm={list.confirmOf(chat.id)} onDelete={() => list.removeChat(chat.id)} />
    </li>
  );
}

/**
 * The owner's chats on this phone, a worker's Talk chats or a household's Find chats, in the menu as the collab app
 * lists its sessions: newest first under Today, Yesterday and Earlier. `shown`: the chat is on screen, so the open one
 * is marked. Each can be deleted after a confirm.
 */
export function DrawerChats({ list, shown, onOpened }: { list: ChatList; shown: boolean; onOpened: () => void }) {
  const { t } = useI18n();
  const now = new Date();
  const groups = groupChats(list.chats, now, -now.getTimezoneOffset());
  return (
    <section className="side-chats" aria-label={t("chats.title")}>
      {groups.length === 0 && <p className={C.faint}>{t("chats.empty")}</p>}
      {groups.map(({ day, chats: inDay }) => (
        <div key={day} className="side-group">
          <span className={C.label}>{t(DAY_LABEL[day])}</span>
          <ul className="sessions">
            {inDay.map((chat) => (
              <ChatRow key={chat.id} chat={chat} list={list} shown={shown} onOpened={onOpened} />
            ))}
          </ul>
        </div>
      ))}
      {groups.length > 0 && <p className={C.faint}>{t("chats.kept", { count: MAX_CHATS })}</p>}
    </section>
  );
}
