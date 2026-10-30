import { type Chat, ChatDay, groupChats, MAX_CHATS, type MessageKey } from "@gigsync/core";
import { useState } from "react";
import { stopSpeaking } from "../../adapters/speech.js";
import { useI18n } from "../../i18n.js";
import { openChat, removeChat, startChat, useTalk } from "../../talk/talkStore.js";
import type { Turn } from "../../talk/turns.js";
import { C } from "../../ui/cls.js";
import { Icon } from "../../ui/Icon.js";

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

/**
 * Talk's header: its name, "Chats", which shows the owner's past chats in place of the open one, and "New chat", which
 * keeps the open chat in that list and starts an empty one (offered once something is said in the open one).
 */
export function TalkHead({ listing, onListing }: { listing: boolean; onListing: (listing: boolean) => void }) {
  const { t } = useI18n();
  const { turns } = useTalk();
  return (
    <div className={`${C.row} talk-head`}>
      <span className={C.labelSq}>{t("nav.talk")}</span>
      <div className={`${C.row} talk-tools`}>
        <button type={C.button} className={C.quiet} aria-expanded={listing} onClick={() => onListing(!listing)}>
          <Icon name="chat" /> {t("chats.open")}
        </button>
        {turns.length > 0 && (
          <button
            type={C.button}
            className={C.quiet}
            onClick={() =>
              going(() => {
                startChat();
                onListing(false);
              })
            }
          >
            <Icon name="plus" /> {t("chats.new")}
          </button>
        )}
      </div>
    </div>
  );
}

/** "Delete" on one chat, with one confirm; it says so when the chat holds the unfinished card. */
function DeleteChat({ title, id, card }: { title: string; id: string; card: boolean }) {
  const { t } = useI18n();
  const [asking, setAsking] = useState(false);
  const label = t("chats.delete_label", { title });
  if (!asking)
    return (
      <button type={C.button} className={C.quiet} aria-label={label} onClick={() => setAsking(true)}>
        {t("chats.delete")}
      </button>
    );
  return (
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
  );
}

/** One past chat: its title opens it; the chat holding the unfinished card says so. */
function ChatRow({ chat, onOpened }: { chat: Chat<Turn>; onOpened: () => void }) {
  const { t } = useI18n();
  const { open, interviewIn } = useTalk();
  const title = chat.title ?? t("chats.untitled");
  const card = interviewIn === chat.id;
  return (
    <li className="chat-row">
      <button
        type={C.button}
        className="chat-open"
        aria-current={chat.id === open}
        onClick={() =>
          going(() => {
            openChat(chat.id);
            onOpened();
          })
        }
      >
        <span className="chat-title">{title}</span>
        {card && <span className={C.faint}>{t("chats.card_waiting")}</span>}
      </button>
      <DeleteChat title={title} id={chat.id} card={card} />
    </li>
  );
}

/**
 * The owner's past chats on this phone, newest first under Today, Yesterday and Earlier, as the collab app listed its
 * sessions. Opening one shows it to read and carry on; each can be deleted after a confirm.
 */
export function ChatList({ onOpened }: { onOpened: () => void }) {
  const { t } = useI18n();
  const { chats } = useTalk();
  const now = new Date();
  const groups = groupChats(chats, now, -now.getTimezoneOffset());
  const title = t("chats.title");
  return (
    <section className={`${C.stack} chat-list`} aria-label={title}>
      {groups.length === 0 && <p className={C.muted}>{t("chats.empty")}</p>}
      {groups.map(({ day, chats: inDay }) => (
        <div key={day} className={C.stack}>
          <span className={C.label}>{t(DAY_LABEL[day])}</span>
          <ul className="chat-rows">
            {inDay.map((chat) => (
              <ChatRow key={chat.id} chat={chat} onOpened={onOpened} />
            ))}
          </ul>
        </div>
      ))}
      <p className={C.faint}>{t("chats.kept", { count: MAX_CHATS })}</p>
    </section>
  );
}
