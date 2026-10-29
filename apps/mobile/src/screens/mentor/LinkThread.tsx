import { type GigDevice, type LinkNote, log, type MentorLink, type MessageKey, NoteFrom } from "@gigsync/core";
import { COLLEAGUE_NOTE_MAX, ColleagueNote } from "@gigsync/protocol";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n.js";
import { Composer } from "../../ui/Composer.js";
import { C } from "../../ui/cls.js";
import { Dock } from "../../ui/Dock.js";
import { Said } from "../../ui/Said.js";
import { IntroActions } from "./IntroActions.js";
import { useLinks } from "./links.js";
import { MentorLinkBar } from "./MentorLinkBar.js";
import { mentorProblem } from "./problems.js";

/** Logs a failed read of this phone's own storage; the thread keeps what it shows. */
const warn = (what: string) => (err: unknown) =>
  log.warn(what, { error: err instanceof Error ? err.message : String(err) });

/** No catalog line says "too long" yet; the generic one at least says it was not sent. */
const TOO_LONG: MessageKey = "error.generic";

interface Props {
  device: GigDevice;
  link: MentorLink;
  run: (work: () => Promise<unknown>) => Promise<unknown>;
  /** Moves after every sync, so notes that just arrived show. */
  syncedAt: Date | undefined;
  /** After the link ends here, or the owner blocks them: the thread is gone. */
  onGone: () => void;
}

/**
 * One mentor link's private notes, oldest first: theirs in this owner's language (translated on this phone, as job
 * notes are), this owner's as they wrote them. Opening it marks theirs as read. Above them: the link's days, Renew,
 * Block and Report, and introductions. End link, after a second tap, ends it on both phones and deletes the notes here.
 */
export function LinkThread({ device, link, run, syncedAt, onGone }: Props) {
  const { lang, t } = useI18n();
  const { refresh } = useLinks();
  const [notes, setNotes] = useState<LinkNote[]>([]);
  const [sent, setSent] = useState(0);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const [problem, setProblem] = useState<MessageKey>();
  const end = useRef<HTMLDivElement>(null);
  const { user, unread } = link;
  const name = link.card.name;
  const endLabel = t("mentor.end");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `syncedAt` and `sent` only exist to read again.
  useEffect(() => {
    let live = true;
    device.mentors.notes(user).then((n) => {
      if (live) setNotes(n);
    }, warn("link notes not read"));
    return () => {
      live = false;
    };
  }, [device, user, syncedAt, sent]);

  // On screen now: their new notes count as read, and the Profile tab's dot goes when nothing else is unread.
  useEffect(() => {
    if (unread > 0) device.mentors.read(user).then(refresh, warn("link notes not marked read"));
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
      await run(() => device.mentors.send(user, text, lang));
      setSent((n) => n + 1);
    } catch (err) {
      setProblem(mentorProblem("sending a link note failed", err));
    } finally {
      setBusy(false);
    }
  }

  async function endLink() {
    try {
      await run(() => device.mentors.end(user));
      refresh();
      onGone();
    } catch (err) {
      setProblem(mentorProblem("ending a mentor link failed", err));
    }
  }

  return (
    <>
      <div className={C.stack}>
        <h1 className={C.headline}>{name}</h1>
        <span className={C.muted}>{link.card.trades.map((tr) => t(`trade.${tr}`)).join(", ")}</span>
      </div>
      <MentorLinkBar device={device} link={link} run={run} onGone={onGone} />
      <IntroActions
        device={device}
        person={{ user, name }}
        run={run}
        ask
        introduce
        onAsked={() => setSent((n) => n + 1)}
      />
      {ending ? (
        <div className={C.cardWait} role="dialog" aria-label={endLabel}>
          <p>{t("mentor.end_confirm", { name })}</p>
          <div className={C.actions}>
            <button type={C.button} className={C.danger} onClick={() => void endLink()}>
              {endLabel}
            </button>
            <button type={C.button} className={C.secondary} onClick={() => setEnding(false)}>
              {t("mentor.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className={C.actions}>
          <button type={C.button} className={C.quiet} onClick={() => setEnding(true)}>
            {endLabel}
          </button>
        </div>
      )}
      {notes.length === 0 ? (
        <div className={C.empty}>{t("mentor.thread_empty", { name })}</div>
      ) : (
        <ul className="link-thread" aria-label={t("a11y.notes")}>
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
          placeholder={t("mentor.placeholder", { name })}
          onSend={(text) => void send(text)}
          busy={busy}
          maxLength={COLLEAGUE_NOTE_MAX}
        />
      </Dock>
    </>
  );
}
