import {
  type Colleague,
  type ColleagueNoteRecord,
  type GigDevice,
  log,
  type MessageKey,
  NoteFrom,
} from "@gigsync/core";
import { COLLEAGUE_NOTE_MAX, ColleagueNote } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n.js";
import { Composer } from "../../ui/Composer.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { Said } from "../../ui/Said.js";
import { useColleagues } from "./context.js";
import { colleagueProblem } from "./problems.js";

/** Logs a failed read of this phone's own storage; the thread keeps what it shows. */
const warn = (what: string) => (err: unknown) =>
  log.warn(what, { error: err instanceof Error ? err.message : String(err) });

/** No catalog line says "too long" yet; the generic one at least says it was not sent. */
const TOO_LONG: MessageKey = "error.generic";

interface Props {
  device: GigDevice;
  colleague: Colleague;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Moves after every sync, so notes that just arrived show. */
  syncedAt: Date | undefined;
  onUnlinked: () => void;
}

/**
 * Two colleagues' private notes, oldest first: theirs in this owner's language (translated on this phone, as job
 * notes are), this owner's as they wrote them. Opening it marks theirs as read. Unlink, after a second tap, ends the
 * link on both phones and deletes the notes here.
 */
export function Thread({ device, colleague, run, syncedAt, onUnlinked }: Props) {
  const { lang, t } = useI18n();
  const { refresh } = useColleagues();
  const [notes, setNotes] = useState<ColleagueNoteRecord[]>([]);
  const [sent, setSent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [problem, setProblem] = useState<MessageKey>();
  const end = useRef<HTMLDivElement>(null);
  const { user, unread } = colleague;
  const name = colleague.card.name;
  const unlinkLabel = t("colleague.unlink");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `syncedAt` and `sent` only exist to read again.
  useEffect(() => {
    let live = true;
    device.colleagues.notes(user).then((n) => {
      if (live) setNotes(n);
    }, warn("colleague notes not read"));
    return () => {
      live = false;
    };
  }, [device, user, syncedAt, sent]);

  // On screen now: their new notes count as read, and the Profile tab's dot goes when nothing else is unread.
  useEffect(() => {
    if (unread > 0) device.colleagues.read(user).then(refresh, warn("colleague notes not marked read"));
  }, [device, user, unread, refresh]);

  useEffect(() => {
    if (notes.length > 0) end.current?.scrollIntoView({ block: "end" });
  }, [notes.length]);

  async function send(text: string) {
    // The composer keeps a longer note in its field; this is the last check before it is sealed.
    if (!ColleagueNote.shape.text.safeParse(text.trim()).success) return setProblem(TOO_LONG);
    setBusy(true);
    setProblem(undefined);
    try {
      await run(() => device.colleagues.send(user, text, lang));
      setSent((n) => n + 1);
    } catch (err) {
      setProblem(colleagueProblem("sending a colleague note failed", err));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    try {
      await run(() => device.colleagues.unlink(user));
      refresh();
      onUnlinked();
    } catch (err) {
      setProblem(colleagueProblem("unlinking a colleague failed", err));
    }
  }

  return (
    <>
      <div className={C.stack}>
        <h1 className={C.headline}>{name}</h1>
        <span className={C.muted}>{colleague.card.trades.map((tr) => t(`trade.${tr}`)).join(", ")}</span>
      </div>
      {unlinking ? (
        <div className={C.cardWait} role="dialog" aria-label={unlinkLabel}>
          <p>{t("colleague.unlink_confirm", { name })}</p>
          <div className={C.actions}>
            <button type={C.button} className={C.danger} onClick={() => void unlink()}>
              {unlinkLabel}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => setUnlinking(false)}>
              {t("colleague.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className={C.actions}>
          <button type={C.button} className={C.quiet} onClick={() => setUnlinking(true)}>
            {unlinkLabel}
          </button>
        </div>
      )}
      {notes.length === 0 ? (
        <div className={C.empty}>{t("colleague.thread_empty", { name })}</div>
      ) : (
        <ul className="colleague-thread" aria-label={t("a11y.notes")}>
          {notes.map((n) =>
            n.from === NoteFrom.me ? (
              <li key={n.id} className="msg-user">
                <div className="bubble">{n.text}</div>
              </li>
            ) : (
              <li key={n.id} className="msg-agent">
                <div className="text">
                  <Said text={n.text} from={n.lang} />
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      <div ref={end} />
      {problem && (
        <p className={C.error} role="status">
          {t(problem, { name })}
        </p>
      )}
      <Dock>
        <Composer
          label={name}
          placeholder={t("colleague.placeholder", { name })}
          onSend={(text) => void send(text)}
          busy={busy}
          maxLength={COLLEAGUE_NOTE_MAX}
        />
      </Dock>
    </>
  );
}
